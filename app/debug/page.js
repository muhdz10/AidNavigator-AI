"use client";

import { useEffect, useState, useCallback } from "react";

export default function DebugPage() {
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filterSession, setFilterSession] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchTraces = useCallback(async () => {
    try {
      const url = filterSession
        ? `/api/debug/traces?session_id=${filterSession}`
        : `/api/debug/traces?limit=50`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTraces(data.traces || []);
      }
    } catch (err) {
      console.error("Failed to fetch traces:", err);
    } finally {
      setLoading(false);
    }
  }, [filterSession]);

  useEffect(() => {
    fetchTraces();
  }, [fetchTraces]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchTraces, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTraces]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatTime = (ts) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const renderJson = (obj) => {
    if (!obj) return <span style={{ color: "var(--text-muted)" }}>null</span>;
    return JSON.stringify(obj, null, 2);
  };

  return (
    <main className="main main-wide">
      <h1 className="page-title">Debug & Tracing</h1>
      <p className="page-subtitle">
        View detailed pipeline traces for every request processed by AidNavigator AI.
      </p>

      {/* Controls */}
      <div style={{
        display: "flex", gap: "12px", marginBottom: "var(--space-xl)",
        flexWrap: "wrap", alignItems: "center",
      }}>
        <input
          type="text"
          className="form-input"
          placeholder="Filter by session ID..."
          value={filterSession}
          onChange={(e) => setFilterSession(e.target.value)}
          style={{ flex: 1, minWidth: "200px", maxWidth: "400px" }}
        />
        <button className="btn btn-secondary" onClick={fetchTraces}>
          🔄 Refresh
        </button>
        <button
          className={`btn ${autoRefresh ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? "⏸ Auto-Refresh ON" : "▶ Auto-Refresh OFF"}
        </button>
        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          {traces.length} trace(s)
        </span>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <div className="loading-text">Loading traces...</div>
        </div>
      ) : traces.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">No traces found.</div>
          <p style={{ color: "var(--text-muted)", marginTop: "8px", fontSize: "0.875rem" }}>
            Submit an intake form to generate trace logs.
          </p>
        </div>
      ) : (
        <div>
          {traces.map((trace) => (
            <div key={trace.id} className="trace-card">
              <div className="trace-header" onClick={() => toggleExpand(trace.id)}>
                <div className="trace-meta">
                  <span className="trace-session">
                    {trace.session_id?.slice(0, 8)}...
                  </span>
                  <span className="trace-time">{formatTime(trace.timestamp)}</span>
                  {trace.blocked && (
                    <span className="trace-flag blocked">🚫 BLOCKED</span>
                  )}
                </div>
                <div className="trace-flags">
                  {(trace.flags || []).slice(0, 3).map((flag, i) => (
                    <span key={i} className="trace-flag">
                      {flag.split(":")[0]}
                    </span>
                  ))}
                  <span style={{ color: "var(--text-muted)", fontSize: "1.25rem" }}>
                    {expandedId === trace.id ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {expandedId === trace.id && (
                <div className="trace-body">
                  {/* Original Input */}
                  {trace.original_input && (
                    <div className="trace-section">
                      <div className="trace-section-title">Original Input</div>
                      <div className="trace-content">{trace.original_input}</div>
                    </div>
                  )}

                  {/* Sanitized Input */}
                  {trace.sanitized_input && (
                    <div className="trace-section">
                      <div className="trace-section-title">Sanitized Input</div>
                      <div className="trace-content">{trace.sanitized_input}</div>
                    </div>
                  )}

                  {/* Profile */}
                  {trace.profile && (
                    <div className="trace-section">
                      <div className="trace-section-title">User Profile</div>
                      <div className="trace-content">{renderJson(trace.profile)}</div>
                    </div>
                  )}

                  {/* Retrieved Chunks */}
                  {trace.retrieved_chunks && trace.retrieved_chunks.length > 0 && (
                    <div className="trace-section">
                      <div className="trace-section-title">
                        Retrieved Chunks ({trace.retrieved_chunks.length})
                      </div>
                      <div className="trace-content">
                        {trace.retrieved_chunks.map((chunk, i) => (
                          <div key={i} style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid var(--border-subtle)" }}>
                            <span style={{ color: "var(--text-accent)" }}>Chunk {i + 1}:</span>
                            {"\n"}{chunk}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Final Prompt */}
                  {trace.final_prompt && (
                    <div className="trace-section">
                      <div className="trace-section-title">Final LLM Prompt</div>
                      <div className="trace-content" style={{ maxHeight: "400px" }}>
                        {trace.final_prompt}
                      </div>
                    </div>
                  )}

                  {/* Output */}
                  {trace.output && (
                    <div className="trace-section">
                      <div className="trace-section-title">LLM Output</div>
                      <div className="trace-content">{renderJson(trace.output)}</div>
                    </div>
                  )}

                  {/* Flags */}
                  {trace.flags && trace.flags.length > 0 && (
                    <div className="trace-section">
                      <div className="trace-section-title">Flags & Warnings</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {trace.flags.map((flag, i) => (
                          <div key={i} style={{
                            padding: "8px 12px", background: "rgba(244, 63, 94, 0.08)",
                            borderRadius: "var(--radius-sm)", border: "1px solid rgba(244, 63, 94, 0.15)",
                            fontSize: "0.8125rem", color: "#fb7185",
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                          }}>
                            {flag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {trace.error && (
                    <div className="trace-section">
                      <div className="trace-section-title">Error</div>
                      <div className="trace-content" style={{ color: "#f87171" }}>
                        {trace.error}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
