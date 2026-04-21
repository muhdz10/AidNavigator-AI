# AidNavigator AI — Welfare & Government Benefits Assistant

A trustworthy AI-powered application that helps users understand which U.S. government benefits they may be eligible for, using structured intake, RAG-based policy analysis, and multi-layered safety guardrails.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **Google API Key** from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone and Install

```bash
# Install Node.js dependencies
npm install

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate  # macOS/Linux

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY
```

### 3. Ingest Policy Documents

```bash
python scripts/ingest.py
```

This loads the real U.S. policy documents, chunks them, generates embeddings, and stores them in a local FAISS vector store.

### 4. Start the Backend

```bash
python -m uvicorn api.main:app --reload --port 8000
```

### 5. Start the Frontend

In a separate terminal:

```bash
npm run dev
```

### 6. Open the App

Visit [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
├── app/                    # Next.js frontend (App Router)
│   ├── layout.js           # Root layout with navigation
│   ├── page.js             # Multi-step intake form
│   ├── globals.css          # Design system & styles
│   ├── results/page.js     # Eligibility results display
│   └── debug/page.js       # Debug/tracing viewer
├── api/                    # FastAPI backend
│   └── main.py             # REST API endpoints
├── services/               # Core business logic
│   ├── rag.py              # RAG pipeline (FAISS retrieval)
│   ├── guardrails.py       # Input sanitization + output validation
│   ├── llm.py              # Google Gemini LLM integration
│   ├── eligibility.py      # Rule-based pre-filtering
│   └── tracing.py          # Structured logging/tracing
├── models/                 # Pydantic data schemas
│   └── schemas.py          # UserProfile, EligibilityResponse, etc.
├── data/                   # Real U.S. policy documents
│   ├── snap_policy.md      # SNAP (Food Stamps)
│   ├── medicaid_policy.md  # Medicaid
│   ├── section8_policy.md  # Section 8 Housing
│   ├── tanf_policy.md      # TANF
│   └── liheap_policy.md    # LIHEAP
├── scripts/                # Ingestion & tooling
│   └── ingest.py           # Document → embeddings → FAISS
├── vectorstore/            # Generated FAISS index
├── requirements.txt        # Python dependencies
├── package.json            # Node.js dependencies
├── vercel.json             # Vercel deployment config
└── .env.example            # Environment variable template
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/intake` | Submit user profile |
| POST | `/api/eligibility` | Run eligibility analysis |
| GET | `/api/debug/traces` | View trace logs |
| GET | `/api/health` | Health check |

---

## 🛡️ Safety & Guardrails

- **Prompt injection detection** — blocks "ignore instructions", "override system", etc.
- **Fraud detection** — blocks requests about fake documents, lying, etc.
- **Output validation** — replaces overconfident language ("guaranteed", "you will definitely")
- **Mandatory disclaimer** — every response includes eligibility disclaimer
- **Rule-based pre-filtering** — deterministic checks run before LLM

---

## 🚀 Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variable
vercel env add GOOGLE_API_KEY

# Deploy
vercel --prod
```

---

## 📄 License

MIT
