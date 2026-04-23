"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ModeWrapper({ children }) {
  const [mode, setMode] = useState(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const savedMode = localStorage.getItem("appMode");
    if (savedMode) {
      setMode(savedMode);
    }
    setMounted(true);
  }, []);

  const selectMode = (selectedMode) => {
    localStorage.setItem("appMode", selectedMode);
    setMode(selectedMode);
  };

  const clearMode = () => {
    localStorage.removeItem("appMode");
    setMode(null);
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) return <div style={{ minHeight: "100vh", background: "var(--bg-main)" }} />;

  // Render the Mode Selection screen if no mode is set
  if (!mode) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-main)",
        padding: "var(--space-xl)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "var(--space-2xl)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }}>🧭</div>
          <h1 style={{ fontSize: "2.5rem", marginBottom: "var(--space-sm)", color: "var(--text-primary)" }}>Choose Experience Mode</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.125rem", maxWidth: "500px" }}>
            Select the view you want for this session. This is for demo purposes only.
          </p>
        </div>

        <div style={{ display: "flex", gap: "var(--space-xl)", flexWrap: "wrap", justifyContent: "center" }}>
          {/* User Mode Card */}
          <div 
            onClick={() => selectMode("user")}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-xl)",
              width: "300px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center"
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
            onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-md)" }}>👤</div>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "var(--space-sm)", color: "var(--text-primary)" }}>User Mode</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Standard experience with a clean, user-friendly interface. No debug or technical information shown.
            </p>
          </div>

          {/* Admin Mode Card */}
          <div 
            onClick={() => selectMode("admin")}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-xl)",
              width: "300px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center"
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
            onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-md)" }}>⚙️</div>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "var(--space-sm)", color: "var(--text-primary)" }}>Admin Mode</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Includes full access to the AI Transparency Dashboard and debug views to trace the AI reasoning pipeline.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render the main app with dynamic navigation
  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">🧭</div>
            AidNavigator AI
          </Link>
          <div className="nav-links">
            <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
              Check Eligibility
            </Link>
            <Link href="/results" className={`nav-link ${pathname === '/results' ? 'active' : ''}`}>
              Results
            </Link>
            {mode === "admin" && (
              <Link href="/transparency" className={`nav-link ${pathname === '/transparency' ? 'active' : ''}`}>
                AI Transparency
              </Link>
            )}
            
            {/* Switch Mode Button */}
            <button 
              onClick={clearMode}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                padding: "6px 12px",
                borderRadius: "var(--radius-full)",
                fontSize: "0.8125rem",
                cursor: "pointer",
                marginLeft: "var(--space-md)",
                transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "var(--bg-glass-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              Switch Mode
            </button>
          </div>
        </div>
      </nav>
      {children}
    </>
  );
}
