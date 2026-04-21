"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming","District of Columbia",
];

const STEPS = [
  { id: 1, label: "Location", icon: "📍" },
  { id: 2, label: "Employment", icon: "💼" },
  { id: 3, label: "Income", icon: "💰" },
  { id: 4, label: "Dependents", icon: "👨‍👩‍👧‍👦" },
  { id: 5, label: "Housing", icon: "🏠" },
  { id: 6, label: "Disability", icon: "♿" },
  { id: 7, label: "Review", icon: "✅" },
];

const EMPLOYMENT_OPTIONS = [
  { value: "employed_full_time", label: "Employed Full-Time" },
  { value: "employed_part_time", label: "Employed Part-Time" },
  { value: "unemployed", label: "Unemployed" },
  { value: "self_employed", label: "Self-Employed" },
  { value: "retired", label: "Retired" },
  { value: "disabled", label: "Disabled / Unable to Work" },
  { value: "student", label: "Student" },
];

const INCOME_OPTIONS = [
  { value: "0-10000", label: "$0 – $10,000" },
  { value: "10001-20000", label: "$10,001 – $20,000" },
  { value: "20001-30000", label: "$20,001 – $30,000" },
  { value: "30001-40000", label: "$30,001 – $40,000" },
  { value: "40001-50000", label: "$40,001 – $50,000" },
  { value: "50001-75000", label: "$50,001 – $75,000" },
  { value: "75001-100000", label: "$75,001 – $100,000" },
  { value: "100001+", label: "$100,001+" },
];

const HOUSING_OPTIONS = [
  { value: "own_home", label: "Own My Home" },
  { value: "renting", label: "Renting" },
  { value: "homeless", label: "Homeless / No Stable Housing" },
  { value: "living_with_family", label: "Living with Family / Friends" },
  { value: "temporary_shelter", label: "Temporary Shelter" },
];

const DISABILITY_OPTIONS = [
  { value: "none", label: "No Disability" },
  { value: "physical", label: "Physical Disability" },
  { value: "mental", label: "Mental Health Condition" },
  { value: "both", label: "Physical & Mental" },
  { value: "prefer_not_to_say", label: "Prefer Not to Say" },
];

export default function IntakePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    location: "",
    employment_status: "",
    income_range: "",
    dependents: 0,
    housing_status: "",
    disability_status: "none",
    additional_info: "",
  });

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const canProceed = () => {
    switch (step) {
      case 1: return form.location !== "";
      case 2: return form.employment_status !== "";
      case 3: return form.income_range !== "";
      case 4: return true;
      case 5: return form.housing_status !== "";
      case 6: return true;
      case 7: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (canProceed() && step < 7) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const profile = {
      location: form.location,
      employment_status: form.employment_status,
      income_range: form.income_range,
      dependents: parseInt(form.dependents) || 0,
      housing_status: form.housing_status,
      disability_status: form.disability_status || "none",
    };

    try {
      // Step 1: Submit intake
      const intakeRes = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          additional_info: form.additional_info || null,
        }),
      });

      if (!intakeRes.ok) {
        const err = await intakeRes.json();
        throw new Error(err.detail?.error || err.detail || "Intake failed");
      }

      const intakeData = await intakeRes.json();
      const sessionId = intakeData.session_id;

      // Step 2: Run eligibility
      const eligRes = await fetch("/api/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          profile,
          additional_info: form.additional_info || null,
        }),
      });

      if (!eligRes.ok) {
        const err = await eligRes.json();
        throw new Error(err.detail || "Eligibility check failed");
      }

      const eligData = await eligRes.json();

      // Store in sessionStorage and navigate
      sessionStorage.setItem("aidnavigator_results", JSON.stringify(eligData));
      sessionStorage.setItem("aidnavigator_profile", JSON.stringify(profile));
      router.push("/results");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="card animate-in">
            <div className="card-header">
              <div className="card-icon purple">📍</div>
              <div>
                <div className="card-title">Where do you live?</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "4px" }}>
                  Select your U.S. state of residence
                </p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="location">State</label>
              <select
                id="location"
                className="form-select"
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
              >
                <option value="">Select your state...</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="card animate-in">
            <div className="card-header">
              <div className="card-icon teal">💼</div>
              <div>
                <div className="card-title">Employment Status</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "4px" }}>
                  What is your current employment situation?
                </p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="employment">Status</label>
              <select
                id="employment"
                className="form-select"
                value={form.employment_status}
                onChange={(e) => updateField("employment_status", e.target.value)}
              >
                <option value="">Select employment status...</option>
                {EMPLOYMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="card animate-in">
            <div className="card-header">
              <div className="card-icon green">💰</div>
              <div>
                <div className="card-title">Annual Household Income</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "4px" }}>
                  Total household income before taxes
                </p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="income">Income Range</label>
              <select
                id="income"
                className="form-select"
                value={form.income_range}
                onChange={(e) => updateField("income_range", e.target.value)}
              >
                <option value="">Select income range...</option>
                {INCOME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="card animate-in">
            <div className="card-header">
              <div className="card-icon amber">👨‍👩‍👧‍👦</div>
              <div>
                <div className="card-title">Dependents</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "4px" }}>
                  Number of dependents in your household (children, elderly, etc.)
                </p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="dependents">Number of Dependents</label>
              <input
                id="dependents"
                type="number"
                className="form-input"
                min="0"
                max="20"
                value={form.dependents}
                onChange={(e) => updateField("dependents", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="card animate-in">
            <div className="card-header">
              <div className="card-icon rose">🏠</div>
              <div>
                <div className="card-title">Housing Situation</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "4px" }}>
                  What is your current living arrangement?
                </p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="housing">Housing Status</label>
              <select
                id="housing"
                className="form-select"
                value={form.housing_status}
                onChange={(e) => updateField("housing_status", e.target.value)}
              >
                <option value="">Select housing status...</option>
                {HOUSING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="card animate-in">
            <div className="card-header">
              <div className="card-icon purple">♿</div>
              <div>
                <div className="card-title">Disability Status</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "4px" }}>
                  This is optional but may affect eligibility for certain programs
                </p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="disability">
                Disability <span className="form-sublabel">(optional)</span>
              </label>
              <select
                id="disability"
                className="form-select"
                value={form.disability_status}
                onChange={(e) => updateField("disability_status", e.target.value)}
              >
                {DISABILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="additional">
                Additional Information <span className="form-sublabel">(optional)</span>
              </label>
              <textarea
                id="additional"
                className="form-textarea"
                value={form.additional_info}
                onChange={(e) => updateField("additional_info", e.target.value)}
                placeholder="Any additional context about your situation..."
                maxLength={500}
              />
            </div>
          </div>
        );

      case 7:
        return (
          <div className="card animate-in">
            <div className="card-header">
              <div className="card-icon green">✅</div>
              <div>
                <div className="card-title">Review Your Information</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "4px" }}>
                  Please confirm everything looks correct before submitting
                </p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                ["Location", form.location],
                ["Employment", EMPLOYMENT_OPTIONS.find(o => o.value === form.employment_status)?.label || "–"],
                ["Income Range", INCOME_OPTIONS.find(o => o.value === form.income_range)?.label || "–"],
                ["Dependents", form.dependents],
                ["Housing", HOUSING_OPTIONS.find(o => o.value === form.housing_status)?.label || "–"],
                ["Disability", DISABILITY_OPTIONS.find(o => o.value === form.disability_status)?.label || "None"],
              ].map(([label, value]) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "10px 16px", background: "var(--bg-glass)",
                  borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)"
                }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{label}</span>
                  <span style={{ color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: 600 }}>{value}</span>
                </div>
              ))}
              {form.additional_info && (
                <div style={{
                  padding: "10px 16px", background: "var(--bg-glass)",
                  borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)"
                }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "4px" }}>Additional Info</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>{form.additional_info}</span>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <main className="main">
        <div className="loading">
          <div className="spinner" />
          <div className="loading-text">Analyzing your eligibility...</div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", textAlign: "center", maxWidth: "400px" }}>
            We&apos;re reviewing federal and state policy documents to find programs you may qualify for.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">Benefits Eligibility Check</h1>
      <p className="page-subtitle">
        Complete each step to discover government assistance programs you may qualify for.
      </p>

      {/* Progress Steps */}
      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
            <div className={`step ${step === s.id ? "active" : ""} ${step > s.id ? "completed" : ""}`}>
              <div className="step-number">
                {step > s.id ? "✓" : s.id}
              </div>
              <span className="step-label">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`step-connector ${step > s.id ? "completed" : ""}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="disclaimer" style={{ background: "rgba(239, 68, 68, 0.08)", borderColor: "rgba(239, 68, 68, 0.2)", marginBottom: "var(--space-lg)" }}>
          <div className="disclaimer-icon">⚠️</div>
          <div className="disclaimer-text" style={{ color: "#f87171" }}>{error}</div>
        </div>
      )}

      {/* Step Content */}
      {renderStep()}

      {/* Navigation Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-xl)" }}>
        <button
          className="btn btn-ghost"
          onClick={prevStep}
          disabled={step === 1}
          style={{ visibility: step === 1 ? "hidden" : "visible" }}
        >
          ← Back
        </button>
        {step < 7 ? (
          <button className="btn btn-primary" onClick={nextStep} disabled={!canProceed()}>
            Continue →
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            🔍 Analyze Eligibility
          </button>
        )}
      </div>
    </main>
  );
}
