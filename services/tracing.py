"""
Tracing module for AidNavigator AI.

Provides structured logging throughout the RAG pipeline.
Each request gets a unique session ID and all steps are logged.
"""

import uuid
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

# Database path — use /tmp on Vercel (read-only filesystem)
import os
if os.environ.get("VERCEL"):
    DB_PATH = Path("/tmp/aidnavigator.db")
else:
    DB_PATH = Path(__file__).parent.parent / "aidnavigator.db"


def _get_connection() -> sqlite3.Connection:
    """Get a SQLite connection with row factory."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the traces table if it doesn't exist."""
    try:
        conn = _get_connection()
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS traces (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                data TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_traces_session
            ON traces (session_id)
            """
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Warning: Could not initialize trace DB: {e}")


# Initialize on import
init_db()


class TraceCollector:
    """
    Collects trace data throughout a single request pipeline.

    Usage:
        trace = TraceCollector()
        trace.log_input("raw user text")
        trace.log_sanitized("cleaned text")
        trace.log_profile({"location": "CA", ...})
        trace.log_retrieval(["chunk1", "chunk2"])
        trace.log_prompt("full prompt sent to LLM")
        trace.log_output({"programs": [...]})
        trace.log_flag("INJECTION_DETECTED")
        trace.save()
    """

    def __init__(self, session_id: Optional[str] = None):
        self.id = str(uuid.uuid4())
        self.session_id = session_id or str(uuid.uuid4())
        self.timestamp = datetime.utcnow().isoformat() + "Z"
        self._data = {
            "original_input": None,
            "sanitized_input": None,
            "profile": None,
            "retrieved_chunks": None,
            "final_prompt": None,
            "output": None,
            "flags": [],
            "blocked": False,
            "error": None,
        }

    def log_input(self, text: str | None):
        """Log the original user input."""
        self._data["original_input"] = text

    def log_sanitized(self, text: str | None):
        """Log the sanitized version of user input."""
        self._data["sanitized_input"] = text

    def log_profile(self, profile: dict):
        """Log the structured user profile."""
        self._data["profile"] = profile

    def log_retrieval(self, chunks: list[str]):
        """Log the retrieved document chunks."""
        self._data["retrieved_chunks"] = chunks

    def log_prompt(self, prompt: str):
        """Log the final prompt sent to the LLM."""
        self._data["final_prompt"] = prompt

    def log_output(self, output: dict):
        """Log the final structured output."""
        self._data["output"] = output

    def log_flag(self, flag: str):
        """Log a flag (security issue, validation issue, etc.)."""
        self._data["flags"].append(flag)

    def log_flags(self, flags: list[str]):
        """Log multiple flags at once."""
        self._data["flags"].extend(flags)

    def log_blocked(self, reason: str):
        """Mark this request as blocked."""
        self._data["blocked"] = True
        self._data["flags"].append(f"BLOCKED: {reason}")

    def log_error(self, error: str):
        """Log an error that occurred during processing."""
        self._data["error"] = error

    def save(self):
        """Persist the trace to SQLite."""
        try:
            init_db()
            conn = _get_connection()
            conn.execute(
                "INSERT INTO traces (id, session_id, timestamp, data) VALUES (?, ?, ?, ?)",
                (self.id, self.session_id, self.timestamp, json.dumps(self._data)),
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Warning: Could not save trace: {e}")

    def to_dict(self) -> dict:
        """Return the full trace as a dictionary."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "timestamp": self.timestamp,
            **self._data,
        }


def get_all_traces(limit: int = 100, offset: int = 0) -> list[dict]:
    """Retrieve all trace logs, newest first."""
    try:
        init_db()
        conn = _get_connection()
        rows = conn.execute(
            "SELECT id, session_id, timestamp, data FROM traces ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        conn.close()

        traces = []
        for row in rows:
            data = json.loads(row["data"])
            traces.append(
                {
                    "id": row["id"],
                    "session_id": row["session_id"],
                    "timestamp": row["timestamp"],
                    **data,
                }
            )
        return traces
    except Exception as e:
        print(f"Warning: Could not read traces: {e}")
        return []


def get_traces_by_session(session_id: str) -> list[dict]:
    """Retrieve all traces for a specific session."""
    try:
        init_db()
        conn = _get_connection()
        rows = conn.execute(
            "SELECT id, session_id, timestamp, data FROM traces WHERE session_id = ? ORDER BY timestamp DESC",
            (session_id,),
        ).fetchall()
        conn.close()

        traces = []
        for row in rows:
            data = json.loads(row["data"])
            traces.append(
                {
                    "id": row["id"],
                    "session_id": row["session_id"],
                    "timestamp": row["timestamp"],
                    **data,
                }
            )
        return traces
    except Exception as e:
        print(f"Warning: Could not read traces: {e}")
        return []


def clear_all_traces():
    """Clear all trace logs (for development/testing only)."""
    try:
        conn = _get_connection()
        conn.execute("DELETE FROM traces")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Warning: Could not clear traces: {e}")
