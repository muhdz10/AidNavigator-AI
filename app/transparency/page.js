"use client";

import { useEffect, useState, useCallback } from "react";

const FLAG_MAPPING = {
  "DISCLAIMER_MISSING": { label: "Missing required safety disclaimer", type: "error" },
  "OVERCONFIDENT_CLAIM": { label: "Overconfident claim detected", type: "warning" },
  "LLM_ERROR": { label: "AI model failed, fallback used", type: "error" },
  "INJECTION_DETECTED": { label: "Prompt injection detected", type: "error" },
  "HTML_STRIPPED": { label: "Potentially unsafe HTML stripped", type: "warning" },
  "FALLBACK_USED": { label: "Fallback rules returned", type: "warning" },
  "NO_CANDIDATES": { label: "No programs matched rule filters", type: "warning" },
  "VECTORSTORE_MISSING": { label: "Vector database missing", type: "error" },
  "RAG_ERROR": { label: "Retrieval error", type: "error" }
};

export default function TransparencyDashboard() {
  const [mode, setMode] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filterSession, setFilterSession] = useState("");
  const [filterType, setFilterType] = useState("all");
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
    const savedMode = localStorage.getItem("appMode");
    setMode(savedMode);
    setAuthChecked(true);
    
    if (savedMode === "admin") {
      fetchTraces();
    }
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

  const getFlagDetails = (flagStr) => {
    const rawName = flagStr.split(":")[0];
    const mapping = FLAG_MAPPING[rawName] || { label: flagStr, type: "warning" };
    return { raw: rawName, ...mapping, fullText: flagStr };
  };

  const filteredTraces = traces.filter(trace => {
    if (filterType === "all") return true;
    if (filterType === "errors") return trace.error || trace.flags?.some(f => getFlagDetails(f).type === "error");
    if (filterType === "blocked") return trace.blocked;
    return true;
  });

  if (!authChecked) {
    return <div style={{ minHeight: "100vh", background: "var(--bg-main)" }} />;
  }

  if (mode !== "admin") {
    return (
      <main className="main" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem", color: "var(--text-primary)" }}>Access Restricted</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
          The AI Transparency view is available only in Admin Mode.
        </p>
        <button 
          className="btn btn-primary"
          onClick={() => {
            localStorage.removeItem("appMode");
            window.location.href = "/";
          }}
        >
          Change Mode
        </button>
      </main>
    );
  }

  return (
    <main className="main main-wide">
      <h1 className="page-title">AI Transparency Dashboard</h1>
      <p className="page-subtitle">
        See how the AI processes input, retrieves policy data, applies safety checks, and generates responses.
      </p>

      {/* Controls */}
      <div style={{
        display: "flex", gap: "12px", marginBottom: "var(--space-xl)",
        flexWrap: "wrap", alignItems: "center",
      }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by session ID..."
          value={filterSession}
          onChange={(e) => setFilterSession(e.target.value)}
          style={{ flex: 1, minWidth: "200px", maxWidth: "300px" }}
        />
        <select 
          className="form-select" 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          style={{ width: "150px" }}
        >
          <option value="all">All Traces</option>
          <option value="errors">With Errors</option>
          <option value="blocked">Blocked / Unsafe</option>
        </select>
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
          {filteredTraces.length} trace(s)
        </span>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <div className="loading-text">Loading pipeline data...</div>
        </div>
      ) : filteredTraces.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">No traces found.</div>
          <p style={{ color: "var(--text-muted)", marginTop: "8px", fontSize: "0.875rem" }}>
            Submit an intake form to generate AI reasoning traces.
          </p>
        </div>
      ) : (
        <div>
          {filteredTraces.map((trace) => {
            const hasSafetyFlags = trace.blocked || (trace.flags && trace.flags.some(f => f.includes("INJECTION") || f.includes("HTML")));
            
            return (
              <div key={trace.id} className="trace-card" style={{ marginBottom: "24px", border: hasSafetyFlags ? "1px solid #f43f5e" : "1px solid var(--border-color)" }}>
                <div className="trace-header" onClick={() => toggleExpand(trace.id)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                      {hasSafetyFlags ? "🔴 Unsafe Request Blocked" : trace.error ? "⚠️ Pipeline Error" : "🟢 Successful Analysis"}
                      <span className="trace-session" style={{ fontSize: "0.75rem", background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: "4px" }}>
                        Session: {trace.session_id?.slice(0, 8)}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "4px" }}>
                      {formatTime(trace.timestamp)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {(trace.flags || []).slice(0, 2).map((flag, i) => {
                      const { label, type } = getFlagDetails(flag);
                      const color = type === "error" ? "#f87171" : "#fbbf24";
                      const bg = type === "error" ? "rgba(248, 113, 113, 0.1)" : "rgba(251, 191, 36, 0.1)";
                      return (
                        <span key={i} style={{ fontSize: "0.75rem", padding: "4px 8px", borderRadius: "4px", color, background: bg }}>
                          {label}
                        </span>
                      );
                    })}
                    <span style={{ color: "var(--text-muted)", fontSize: "1.25rem", marginLeft: "8px" }}>
                      {expandedId === trace.id ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {expandedId === trace.id && (
                  <div className="trace-body" style={{ padding: "20px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-base)" }}>
                    
                    {/* Safety Section */}
                    {hasSafetyFlags && (
                      <div style={{ padding: "16px", background: "rgba(244, 63, 94, 0.08)", border: "1px solid rgba(244, 63, 94, 0.2)", borderRadius: "var(--radius-md)", marginBottom: "20px" }}>
                        <h4 style={{ color: "#fb7185", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "6px" }}>⚠️ Safety & Guardrails Activated</h4>
                        {trace.blocked && <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "4px" }}>Request was blocked by security rules.</div>}
                        <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                          {(trace.flags || []).filter(f => f.includes("BLOCKED") || f.includes("INJECTION") || f.includes("HTML")).map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
                      
                      {/* Step 1: Input */}
                      {trace.original_input && (
                        <div className="pipeline-step">
                          <div className="step-title">1. Raw Input</div>
                          <div className="step-content">
                            <p style={{ margin: 0, color: "var(--text-secondary)", fontStyle: "italic" }}>"{trace.original_input}"</p>
                          </div>
                        </div>
                      )}

                      {/* Step 2: Sanitized Input */}
                      {trace.sanitized_input && trace.sanitized_input !== trace.original_input && (
                        <div className="pipeline-step">
                          <div className="step-title">2. Sanitized Input</div>
                          <div className="step-content">
                            <p style={{ margin: 0, color: "var(--text-secondary)" }}>{trace.sanitized_input}</p>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Profile Extraction */}
                      {trace.profile && (
                        <div className="pipeline-step">
                          <div className="step-title">3. Structured Profile</div>
                          <div className="step-content">
                            <pre style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)", background: "var(--bg-glass)", padding: "12px", borderRadius: "var(--radius-sm)", overflowX: "auto" }}>
                              {renderJson(trace.profile)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Step 4: Retrieval */}
                      {trace.retrieved_chunks && trace.retrieved_chunks.length > 0 && (
                        <div className="pipeline-step">
                          <div className="step-title">4. Policy Retrieval (Vector Search)</div>
                          <div className="step-content" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {trace.retrieved_chunks.map((chunk, i) => (
                              <div key={i} style={{ padding: "12px", background: "var(--bg-glass)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                  <strong style={{ color: "var(--text-primary)", fontSize: "0.875rem" }}>{chunk.source || `Excerpt ${i + 1}`}</strong>
                                  <a href={chunk.url || "#"} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: "0.8125rem", textDecoration: "none" }}>View Policy ↗</a>
                                </div>
                                <div style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", fontStyle: "italic", lineHeight: "1.5" }}>
                                  "{typeof chunk === "string" ? chunk : chunk.content?.substring(0, 300) + "..."}"
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Step 5: LLM Execution */}
                      <div className="pipeline-step">
                        <div className="step-title">5. AI Model Execution</div>
                        <div className="step-content" style={{ padding: "12px", background: "var(--bg-glass)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                              <strong>Status: </strong> 
                              {trace.llm_used ? "🟢 Generated Response" : trace.fallback_used ? "⚠️ Fallback Rules Triggered" : "🔴 Not Used"}
                            </span>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem", background: "var(--bg-secondary)", padding: "2px 8px", borderRadius: "12px" }}>
                              <strong>Model:</strong> Groq (Llama 3 8B)
                            </span>
                          </div>
                          {trace.final_prompt && (
                            <details style={{ marginTop: "12px" }}>
                              <summary style={{ cursor: "pointer", fontSize: "0.8125rem", color: "var(--primary)" }}>View Full Prompt (Advanced)</summary>
                              <pre style={{ marginTop: "12px", fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "4px" }}>
                                {trace.final_prompt}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>

                      {/* Step 6: Validation */}
                      {(trace.flags || []).length > 0 && !hasSafetyFlags && (
                        <div className="pipeline-step">
                          <div className="step-title">6. Output Validation</div>
                          <div className="step-content">
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {trace.flags.map((flagStr, i) => {
                                const { label, type, fullText } = getFlagDetails(flagStr);
                                const color = type === "error" ? "#fb7185" : "#fbbf24";
                                return (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    <span style={{ color }}>{type === "error" ? "🔴" : "⚠️"}</span>
                                    <span><strong>{label}:</strong> {fullText.substring(fullText.indexOf(":") + 1)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 7: Final Output */}
                      {trace.output && (
                        <div className="pipeline-step">
                          <div className="step-title">7. Final Response Sent to User</div>
                          <div className="step-content">
                            <pre style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-primary)", background: "rgba(16, 185, 129, 0.05)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(16, 185, 129, 0.2)", overflowX: "auto" }}>
                              {renderJson(trace.output)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {trace.error && (
                        <div className="pipeline-step">
                          <div className="step-title" style={{ color: "#f87171" }}>System Error</div>
                          <div className="step-content" style={{ color: "#f87171", background: "rgba(248, 113, 113, 0.1)", padding: "12px", borderRadius: "4px" }}>
                            {trace.error}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      <style jsx>{`
        .pipeline-step {
          position: relative;
          padding-left: 24px;
          border-left: 2px solid var(--border-subtle);
          padding-bottom: 20px;
        }
        .pipeline-step:last-child {
          border-left: 2px solid transparent;
        }
        .pipeline-step::before {
          content: "";
          position: absolute;
          left: -7px;
          top: 4px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--primary);
          border: 2px solid var(--bg-base);
        }
        .step-title {
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
          font-size: 0.9375rem;
        }
        .step-content {
          padding-left: 4px;
        }
      `}</style>
    </main>
  );
}
