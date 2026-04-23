"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appMode, setAppMode] = useState(null);

  useEffect(() => {
    const storedResults = sessionStorage.getItem("aidnavigator_results");
    const storedProfile = sessionStorage.getItem("aidnavigator_profile");

    if (storedResults) {
      setResults(JSON.parse(storedResults));
    }
    if (storedProfile) {
      setProfile(JSON.parse(storedProfile));
    }
    setAppMode(localStorage.getItem("appMode"));
  }, []);

  if (!results) {
    return (
      <main className="main">
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">No results yet.</div>
          <p style={{ color: "var(--text-muted)", marginTop: "8px", fontSize: "0.875rem" }}>
            Complete the intake form first to see your eligibility results.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: "24px" }}
            onClick={() => router.push("/")}
          >
            Start Intake Form
          </button>
        </div>
      </main>
    );
  }

  const programIcons = {
    SNAP: "🍎",
    Medicaid: "🏥",
    "Section 8 Housing": "🏠",
    TANF: "👨‍👩‍👧",
    LIHEAP: "⚡",
    WIC: "🍼",
    SSI: "💵",
    CHIP: "🧸",
  };

  const programFullNames = {
    SNAP: "Supplemental Nutrition Assistance Program",
    TANF: "Temporary Assistance for Needy Families",
    LIHEAP: "Low Income Home Energy Assistance Program",
    WIC: "Special Supplemental Nutrition Program for Women, Infants, and Children",
    SSI: "Supplemental Security Income",
    CHIP: "Children's Health Insurance Program",
  };

  const programBenefits = {
    SNAP: "Food Assistance",
    TANF: "Cash Assistance",
    LIHEAP: "Energy & Utility Assistance",
    WIC: "Nutrition for Women & Children",
    SSI: "Disability Cash Assistance",
    CHIP: "Children's Health Insurance",
    Medicaid: "Health Coverage",
    "Section 8 Housing": "Housing & Rent Assistance",
    CalFresh: "Food Assistance"
  };

  const getProgramBenefit = (name) => {
    for (const [key, benefit] of Object.entries(programBenefits)) {
      if (name.includes(key)) {
        return benefit;
      }
    }
    return "Government Assistance";
  };

  const getProgramDisplayName = (name) => {
    let displayName = name;
    for (const [acronym, fullName] of Object.entries(programFullNames)) {
      // If the name exactly matches the acronym or contains the acronym as a standalone word
      // but doesn't already contain the full name
      const regex = new RegExp(`\\b${acronym}\\b`, "i");
      if (regex.test(name) && !name.toLowerCase().includes(fullName.toLowerCase())) {
        displayName = `${name} (${fullName})`;
        break; // Only expand the first matched acronym to keep it clean
      }
    }
    return displayName;
  };

  return (
    <main className="main">
      <h1 className="page-title">Your Eligibility Results</h1>
      <p className="page-subtitle">
        Based on your profile, here are the programs you may be eligible for.
      </p>

      {/* Disclaimer */}
      <div className="disclaimer animate-in">
        <div className="disclaimer-icon">⚠️</div>
        <div className="disclaimer-text">
          {results.disclaimer}
        </div>
      </div>

      {/* Profile Summary */}
      {profile && (
        <div className="card animate-in" style={{ marginBottom: "var(--space-xl)" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
            Your Profile
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {[
              `📍 ${profile.location}`,
              `💼 ${profile.employment_status?.replace(/_/g, " ")}`,
              `💰 $${profile.income_range}`,
              `👥 ${profile.dependents} dependent(s)`,
              `🏠 ${profile.housing_status?.replace(/_/g, " ")}`,
            ].map((tag) => (
              <span key={tag} style={{
                fontSize: "0.8125rem", padding: "4px 12px",
                background: "var(--bg-glass-hover)", borderRadius: "var(--radius-full)",
                color: "var(--text-secondary)", border: "1px solid var(--border-subtle)",
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Programs */}
      {results.programs && results.programs.length > 0 ? (
        <div className="results-grid">
          {results.programs.map((prog, i) => (
            <div key={i} className="program-card animate-in">
              <div style={{ marginBottom: "var(--space-md)" }}>
                <div className="program-name" style={{ marginBottom: "4px" }}>
                  <span style={{ fontSize: "1.5rem" }}>
                    {programIcons[prog.name] || "📄"}
                  </span>
                  {getProgramDisplayName(prog.name)}
                  <span className="program-badge">May Qualify</span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--primary-light)", fontWeight: 500, marginLeft: "36px" }}>
                  {getProgramBenefit(prog.name)}
                </div>
              </div>

              <div className="program-reason">{prog.reason}</div>

              {prog.how_to_apply && (
                <div style={{ marginTop: "12px", padding: "12px", background: "var(--bg-glass-hover)", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--primary)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                    🚀 How to Apply
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    {prog.how_to_apply}
                  </div>
                </div>
              )}

              {prog.documents_required && prog.documents_required.length > 0 && (
                <div>
                  <div className="docs-title">📋 Required Documents</div>
                  <ul className="docs-list">
                    {prog.documents_required.map((doc, j) => (
                      <li key={j}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-text">
            No programs matched your profile at this time.
          </div>
          <p style={{ color: "var(--text-muted)", marginTop: "8px", fontSize: "0.875rem" }}>
            This doesn&apos;t mean you&apos;re ineligible. Contact your local social services office for a full assessment.
          </p>
        </div>
      )}

      {/* Sources */}
      {results.sources && results.sources.length > 0 && (
        <div className="sources animate-in">
          <div className="sources-title">📚 Sources Used</div>
          <ul className="sources-list">
            {results.sources.map((src, i) => (
              <li key={i}>
                {src.url && src.url !== "#" ? (
                  <a 
                    href={src.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: "var(--primary-light)", textDecoration: "none" }}
                    onMouseOver={(e) => e.currentTarget.style.textDecoration = "underline"}
                    onMouseOut={(e) => e.currentTarget.style.textDecoration = "none"}
                  >
                    {src.name} ↗
                  </a>
                ) : (
                  src.name || src
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px", marginTop: "var(--space-xl)", justifyContent: "center" }}>
        <button className="btn btn-secondary" onClick={() => router.push("/")}>
          ← Start Over
        </button>
        {appMode === "admin" && (
          <button className="btn btn-ghost" onClick={() => router.push("/transparency")}>
            🔍 View Debug Traces
          </button>
        )}
      </div>
    </main>
  );
}
