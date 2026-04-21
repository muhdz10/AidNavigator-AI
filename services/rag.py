"""
RAG pipeline for AidNavigator AI.

Handles document retrieval from FAISS vector store
and context preparation for the LLM.
"""

import os
from pathlib import Path
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from models.schemas import UserProfile

VECTORSTORE_PATH = Path(__file__).parent.parent / "vectorstore"


def _get_embeddings():
    """Get the Google embedding model."""
    return GoogleGenerativeAIEmbeddings(
        model=os.getenv("GOOGLE_EMBEDDING_MODEL", "models/gemini-embedding-001"),
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )


def load_vectorstore():
    """Load the FAISS vector store from disk."""
    if not VECTORSTORE_PATH.exists():
        raise FileNotFoundError(
            "Vector store not found. Run 'python scripts/ingest.py' first."
        )
    embeddings = _get_embeddings()
    return FAISS.load_local(
        str(VECTORSTORE_PATH), embeddings, allow_dangerous_deserialization=True
    )


def profile_to_query(profile: UserProfile) -> str:
    """Convert a user profile into a natural language retrieval query."""
    parts = [
        f"Government benefits eligibility for a person in {profile.location}",
        f"who is {profile.employment_status.replace('_', ' ')}",
        f"with annual income in the {profile.income_range} range",
        f"with {profile.dependents} dependent(s)",
        f"housing status: {profile.housing_status.replace('_', ' ')}",
    ]
    if profile.disability_status and profile.disability_status not in (
        "none",
        "prefer_not_to_say",
    ):
        parts.append(f"disability status: {profile.disability_status}")
    return ", ".join(parts)


def retrieve_relevant_chunks(
    profile: UserProfile, candidate_programs: list[str], top_k: int = 8
) -> list[dict]:
    """
    Retrieve relevant policy document chunks based on user profile
    and candidate programs from rule-based filtering.

    Returns list of dicts with 'content' and 'source' keys.
    """
    vectorstore = load_vectorstore()

    # Build query from profile
    query = profile_to_query(profile)

    # Add program names to improve retrieval relevance
    if candidate_programs:
        query += " Programs: " + ", ".join(candidate_programs)

    # Retrieve top-k chunks
    results = vectorstore.similarity_search_with_score(query, k=top_k)

    chunks = []
    for doc, score in results:
        chunks.append(
            {
                "content": doc.page_content,
                "source": doc.metadata.get("source", "Unknown"),
                "score": float(score),
            }
        )

    return chunks
