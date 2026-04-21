"""
LLM service for AidNavigator AI.

Handles interaction with Google Gemini via LangChain.
Uses a strong system prompt enforcing safety and structured output.
"""

import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from models.schemas import UserProfile

SYSTEM_PROMPT = """You are AidNavigator AI, a government benefits advisor assistant. Your role is to help users understand which U.S. government assistance programs they may be eligible for.

## CRITICAL SAFETY RULES — YOU MUST FOLLOW THESE AT ALL TIMES:

1. NEVER claim or imply that a user is guaranteed to be eligible for any program.
2. NEVER assist with fraud, falsifying documents, or misrepresenting information.
3. NEVER provide legal advice — you are an informational tool only.
4. ALWAYS use hedging language: "you may be eligible", "you could potentially qualify", "based on the information provided, it appears that..."
5. ALWAYS include a disclaimer that final eligibility is determined by the official agency.
6. ONLY base your suggestions on the retrieved policy documents provided below. Do NOT make up eligibility criteria.

## YOUR TASK:

Given the user's profile and the retrieved policy document excerpts below, you must:

1. Identify 2-4 government benefit programs the user may be eligible for.
2. For each program, explain WHY they may qualify based on specific criteria from the policy documents.
3. List the required documents for each program application.
4. Be specific — reference income thresholds, household size requirements, and other concrete criteria from the documents.

## OUTPUT FORMAT:

You MUST respond with valid JSON only (no markdown, no code fences). Use this exact structure:

{
  "programs": [
    {
      "name": "Program Name",
      "reason": "Detailed explanation of why this person may be eligible, referencing specific policy criteria...",
      "documents_required": ["Document 1", "Document 2"]
    }
  ],
  "sources": ["Source 1", "Source 2"]
}

Do NOT include any text outside the JSON object. Do NOT use markdown code fences."""


def build_prompt(
    profile: UserProfile,
    candidate_programs: list[dict],
    retrieved_chunks: list[dict],
) -> str:
    """Build the full prompt for the LLM."""
    # Format retrieved context
    context_parts = []
    for i, chunk in enumerate(retrieved_chunks, 1):
        source = chunk.get("source", "Unknown")
        context_parts.append(
            f"--- Document Excerpt {i} (Source: {source}) ---\n{chunk['content']}"
        )
    context = "\n\n".join(context_parts)

    # Format candidate programs from rule-based filter
    candidates_text = ""
    if candidate_programs:
        candidates_text = "\n## Pre-screened Candidate Programs:\n"
        for cp in candidate_programs:
            reasons = "; ".join(cp.get("reasons", []))
            candidates_text += f"- **{cp['program']}**: {reasons}\n"

    # Format user profile
    profile_text = f"""
## User Profile:
- Location: {profile.location}
- Employment Status: {profile.employment_status.replace('_', ' ')}
- Annual Income Range: ${profile.income_range}
- Number of Dependents: {profile.dependents}
- Housing Status: {profile.housing_status.replace('_', ' ')}
- Disability Status: {profile.disability_status or 'Not specified'}
"""

    prompt = f"""{profile_text}
{candidates_text}
## Retrieved Policy Documents:

{context}

Based on the user profile and the policy documents above, provide your eligibility analysis as JSON."""

    return prompt


def generate_eligibility_response(
    profile: UserProfile,
    candidate_programs: list[dict],
    retrieved_chunks: list[dict],
) -> tuple[dict, str]:
    """
    Generate an eligibility response using Google Gemini.

    Returns:
        tuple: (parsed_response_dict, full_prompt_string)
    """
    model_name = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash")
    api_key = os.getenv("GOOGLE_API_KEY")

    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is not set.")

    llm = ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=api_key,
        temperature=0.2,
        max_output_tokens=16384,
    )

    prompt = build_prompt(profile, candidate_programs, retrieved_chunks)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ]

    response = llm.invoke(messages)
    raw_text = response.content.strip()

    # Clean markdown fences if present (handles ```json, ```JSON, ``` etc.)
    import re
    fence_match = re.match(r'^```(?:json|JSON)?\s*\n(.*?)\n```\s*$', raw_text, re.DOTALL)
    if fence_match:
        raw_text = fence_match.group(1).strip()
    elif raw_text.startswith("```"):
        lines = raw_text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        raw_text = "\n".join(lines).strip()

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        # Try to extract JSON object by finding matching braces
        start = raw_text.find("{")
        if start != -1:
            depth = 0
            end = -1
            in_string = False
            escape_next = False
            for i in range(start, len(raw_text)):
                c = raw_text[i]
                if escape_next:
                    escape_next = False
                    continue
                if c == "\\":
                    escape_next = True
                    continue
                if c == '"':
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            if end > start:
                try:
                    parsed = json.loads(raw_text[start:end])
                except json.JSONDecodeError:
                    parsed = {
                        "programs": [],
                        "sources": [],
                        "error": "Failed to parse LLM response",
                        "raw_response": raw_text[:500],
                    }
            else:
                parsed = {
                    "programs": [],
                    "sources": [],
                    "error": "Failed to parse LLM response",
                    "raw_response": raw_text[:500],
                }
        else:
            parsed = {
                "programs": [],
                "sources": [],
                "error": "Failed to parse LLM response",
                "raw_response": raw_text[:500],
            }

    return parsed, prompt
