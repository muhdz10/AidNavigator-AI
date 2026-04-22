"""
FastAPI backend for AidNavigator AI.

Endpoints:
- POST /api/intake        — Submit user profile
- POST /api/eligibility   — Run eligibility analysis
- GET  /api/debug/traces  — View trace logs
- GET  /api/health        — Health check
"""

import os
import sys
import uuid
from pathlib import Path
from contextlib import asynccontextmanager

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from models.schemas import (
    UserProfile,
    IntakeRequest,
    EligibilityRequest,
    EligibilityResponse,
    Program,
    Source,
)
from services.guardrails import sanitize_input, validate_output, validate_profile_fields
from services.tracing import TraceCollector, get_all_traces, get_traces_by_session
from services.eligibility import run_eligibility_filters


# ── In-memory session store ───────────────────────────────────────────────────
sessions: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown."""
    # Startup
    print("AidNavigator AI backend starting...")
    yield
    # Shutdown
    print("AidNavigator AI backend shutting down...")


app = FastAPI(
    title="AidNavigator AI",
    description="Welfare & Government Benefits Assistant API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    vectorstore_exists = (Path(__file__).parent.parent / "vectorstore").exists()
    return {
        "status": "healthy",
        "vectorstore_ready": vectorstore_exists,
        "google_api_key_set": bool(os.getenv("GOOGLE_API_KEY")),
    }


# ── Intake ────────────────────────────────────────────────────────────────────

class IntakeResponse(BaseModel):
    session_id: str
    profile: UserProfile
    message: str


@app.post("/api/intake", response_model=IntakeResponse)
async def intake(request: IntakeRequest):
    """
    Submit user intake profile.
    Validates input, creates a session, and stores the profile.
    """
    trace = TraceCollector()

    # Log raw input
    trace.log_input(request.additional_info)
    trace.log_profile(request.profile.model_dump())

    # Validate profile fields for injection
    field_flags = validate_profile_fields(request.profile.model_dump())
    if field_flags:
        trace.log_flags(field_flags)

    # Sanitize additional info
    if request.additional_info:
        result = sanitize_input(request.additional_info)
        trace.log_sanitized(result.sanitized_text)
        if result.flags:
            trace.log_flags(result.flags)
        if result.blocked:
            trace.log_blocked(result.reason or "Blocked input")
            trace.save()
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Input blocked for safety reasons.",
                    "session_id": trace.session_id,
                },
            )

    # Create session
    session_id = trace.session_id
    sessions[session_id] = {
        "profile": request.profile.model_dump(),
        "additional_info": request.additional_info,
    }

    trace.save()

    return IntakeResponse(
        session_id=session_id,
        profile=request.profile,
        message="Profile received. Ready for eligibility analysis.",
    )


# ── Eligibility ───────────────────────────────────────────────────────────────

@app.post("/api/eligibility", response_model=EligibilityResponse)
async def eligibility(request: EligibilityRequest):
    """
    Run the full eligibility analysis pipeline:
    1. Guardrails (input sanitization)
    2. Rule-based pre-filtering
    3. RAG retrieval
    4. LLM generation
    5. Output validation
    """
    trace = TraceCollector(session_id=request.session_id)
    trace.log_profile(request.profile.model_dump())

    # Sanitize additional info
    if request.additional_info:
        trace.log_input(request.additional_info)
        san = sanitize_input(request.additional_info)
        trace.log_sanitized(san.sanitized_text)
        if san.flags:
            trace.log_flags(san.flags)
        if san.blocked:
            trace.log_blocked(san.reason or "Blocked")
            trace.save()
            raise HTTPException(status_code=400, detail="Input blocked for safety.")

    # Step 1: Rule-based pre-filtering
    try:
        candidate_programs = run_eligibility_filters(request.profile)
    except Exception as e:
        trace.log_error(f"Rule filter error: {str(e)}")
        candidate_programs = []

    if not candidate_programs:
        trace.log_flag("NO_CANDIDATES: No programs matched rule-based filters")
        trace.save()
        return EligibilityResponse(
            session_id=request.session_id,
            programs=[],
            sources=[],
            disclaimer=(
                "Based on the information provided, we could not identify programs "
                "you may be eligible for. This does not mean you are ineligible — "
                "please contact your local social services office for a comprehensive assessment."
            ),
        )

    # Step 2: RAG retrieval
    retrieved_chunks = []
    try:
        from services.rag import retrieve_relevant_chunks
        program_names = [cp["program"] for cp in candidate_programs]
        retrieved_chunks = retrieve_relevant_chunks(
            request.profile, program_names, top_k=8
        )
        trace.log_retrieval(retrieved_chunks)
    except FileNotFoundError:
        trace.log_flag("VECTORSTORE_MISSING: Using rule-based results only")
    except Exception as e:
        trace.log_error(f"RAG error: {str(e)}")
        trace.log_flag(f"RAG_ERROR: {str(e)}")

    # Step 3: LLM generation
    llm_response = None
    if retrieved_chunks and os.getenv("GOOGLE_API_KEY"):
        try:
            from services.llm import generate_eligibility_response
            llm_response, full_prompt = generate_eligibility_response(
                request.profile, candidate_programs, retrieved_chunks
            )
            trace.log_prompt(full_prompt)
            trace.log_output(llm_response)
            trace.log_llm_used(True)
        except Exception as e:
            trace.log_error(f"LLM error: {str(e)}")
            trace.log_flag(f"LLM_ERROR: {str(e)}")

    # Step 4: Build response (from LLM or fallback to rules)
    programs = []
    sources = []

    # Extract sources deterministically from the RAG chunks
    # This guarantees sources are real and exactly what was provided to the LLM
    unique_sources = {}
    for chunk in retrieved_chunks:
        source_name = chunk.get("source", "Unknown Policy Document")
        # Ensure url fallback for older chunks without a URL
        url = chunk.get("url") or "#"
        unique_sources[source_name] = url
        
    for name, url in unique_sources.items():
        sources.append(Source(name=name, url=url))

    if llm_response and "programs" in llm_response:
        # Validate each program's reason text
        for prog in llm_response["programs"]:
            validated = validate_output(prog.get("reason", ""))
            if validated.modifications:
                trace.log_flags(validated.modifications)
            programs.append(
                Program(
                    name=prog.get("name", "Unknown"),
                    reason=validated.validated_text,
                    documents_required=prog.get("documents_required", []),
                )
            )
    else:
        # Fallback: use rule-based results
        trace.log_fallback_used(True)
        trace.log_flag("FALLBACK_USED: Returning rule-based pre-filters")
        doc_map = {
            "SNAP": ["Government ID", "Proof of income", "Social Security numbers",
                      "Proof of residency", "Bank statements"],
            "Medicaid": ["Birth certificate or ID", "Proof of income", "Social Security number",
                         "Proof of residency", "Proof of citizenship"],
            "Section 8 Housing": ["Government ID", "Social Security cards", "Birth certificates",
                                   "Proof of income", "Rental history"],
            "TANF": ["ID for all members", "Social Security numbers", "Birth certificates",
                      "Proof of income", "Proof of residency"],
            "LIHEAP": ["Government ID", "Social Security numbers", "Proof of income",
                        "Recent utility bill", "Proof of residency"],
        }
        for cp in candidate_programs:
            programs.append(
                Program(
                    name=cp["program"],
                    reason=" ".join(cp["reasons"]),
                    documents_required=doc_map.get(cp["program"], ["Contact local office"]),
                )
            )
            
        # If there were no RAG sources (e.g. vectorstore missing), add a fallback source
        if not sources:
            sources.append(Source(name="Rule-based eligibility screening", url="#"))

    trace.save()

    return EligibilityResponse(
        session_id=request.session_id,
        programs=programs,
        sources=sources,
    )


# ── Debug Traces ──────────────────────────────────────────────────────────────

@app.get("/api/debug/traces")
async def debug_traces(
    session_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """Retrieve trace logs for debugging."""
    if session_id:
        traces = get_traces_by_session(session_id)
    else:
        traces = get_all_traces(limit=limit, offset=offset)
    return {"traces": traces, "count": len(traces)}


# ── Run with uvicorn ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
