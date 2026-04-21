"""
Document ingestion script for AidNavigator AI.

Loads policy documents from data/, chunks them, generates embeddings
via Google Generative AI, and stores them in a FAISS vector store.

Usage:
    python scripts/ingest.py
"""

import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

load_dotenv()

DATA_DIR = Path(__file__).parent.parent / "data"
VECTORSTORE_DIR = Path(__file__).parent.parent / "vectorstore"


def load_documents() -> list[Document]:
    """Load all markdown policy documents from data/."""
    documents = []
    for filepath in sorted(DATA_DIR.glob("*.md")):
        print(f"  Loading: {filepath.name}")
        text = filepath.read_text(encoding="utf-8")
        documents.append(
            Document(
                page_content=text,
                metadata={"source": filepath.stem.replace("_", " ").title()},
            )
        )
    print(f"  Loaded {len(documents)} documents.\n")
    return documents


def chunk_documents(documents: list[Document]) -> list[Document]:
    """Split documents into smaller chunks for embedding."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
        separators=["\n## ", "\n### ", "\n\n", "\n", ". ", " "],
    )
    chunks = splitter.split_documents(documents)
    print(f"  Split into {len(chunks)} chunks.\n")
    return chunks


def create_vectorstore(chunks: list[Document]):
    """Generate embeddings and create FAISS index."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY not set. Copy .env.example to .env and add your key.")
        sys.exit(1)

    model = os.getenv("GOOGLE_EMBEDDING_MODEL", "models/gemini-embedding-001")
    print(f"  Using embedding model: {model}")
    embeddings = GoogleGenerativeAIEmbeddings(model=model, google_api_key=api_key)

    print("  Generating embeddings (this may take a moment)...")
    vectorstore = FAISS.from_documents(chunks, embeddings)

    VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)
    vectorstore.save_local(str(VECTORSTORE_DIR))
    print(f"  Vector store saved to {VECTORSTORE_DIR}/\n")


def main():
    print("\n╔══════════════════════════════════════════╗")
    print("║   AidNavigator AI — Document Ingestion   ║")
    print("╚══════════════════════════════════════════╝\n")

    print("Step 1: Loading documents...")
    documents = load_documents()

    print("Step 2: Chunking documents...")
    chunks = chunk_documents(documents)

    print("Step 3: Creating vector store...")
    create_vectorstore(chunks)

    print("✅ Ingestion complete! You can now start the backend.\n")


if __name__ == "__main__":
    main()
