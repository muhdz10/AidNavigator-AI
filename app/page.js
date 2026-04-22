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
  { id: 2, label: "Demographics", icon: "👤" },
  { id: 3, label: "Special Status", icon: "⭐" },
  { id: 4, label: "Employment", icon: "💼" },
  { id: 5, label: "Income", icon: "💰" },
  { id: 6, label: "Dependents", icon: "👨‍👩‍👧‍👦" },
  { id: 7, label: "Housing", icon: "🏠" },
  { id: 8, label: "Disability", icon: "♿" },
  { id: 9, label: "Review", icon: "✅" },
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
    age: "",
    gender: "",
    is_pregnant: false,
    is_student: false,
    employment_status: "",
    income_range: "",
    dependents: 0,
    has_dependents_under_5: false,
    has_dependents_under_19: false,
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
      case 2: return form.age !== "" && form.gender !== "";
      case 3: return true; // special status is optional toggles
      case 4: return form.employment_status !== "";
      case 5: return form.income_range !== "";
      case 6: return true;
      case 7: return form.housing_status !== "";
      case 8: return true;
      case 9: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (canProceed() && step < 9) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const profile = {
      location: form.location,
      age: parseInt(form.age) || 0,
      gender: form.gender,
      is_pregnant: form.is_pregnant,
      is_student: form.is_student,
      employment_status: form.employment_status,
      income_range: form.income_range,
      dependents: parseInt(form.dependents) || 0,
      has_dependents_under_5: form.has_dependents_under_5,
      has_dependents_under_19: form.has_dependents_under_19,
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
              <div className="card-icon blue">👤</div>
              <div>
                <div className="card-title">Demographics</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "4px" }}>
                  A few details about yourself
                </p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="age">Age</label>
              <input
                id="age"
                type="number"
                className="form-input"
                min="0"
                max="120"
                value={form.age}
                onChange={(e) => updateField("age", e.target.value)}
                placeholder="e.g. 35"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="gender">Gender</label>
              <select
                id="gender"
                className="form-select"
                value={form.gender}
                onChange={(e) => updateField("gender", e.target.value)}
              >
                <option value="">Select your gender...</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="card animate-in">
            <div className="card-header">
              <div className="card-icon amber">⭐</div>
              <div>
                <div className="card-title">Special Status</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "4px" }}>
                  Certain statuses can qualify you for specific programs
                </p>
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <input
                id="is_pregnant"
                type="checkbox"
                checked={form.is_pregnant}
                onChange={(e) => updateField("is_pregnant", e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
              />
              <label htmlFor="is_pregnant" style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                I am currently pregnant or postpartum (within the last year)
              </label>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <input
                id="is_student"
                type="checkbox"
                checked={form.is_student}
                onChange={(e) => updateField("is_student", e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
              />
              <label htmlFor="is_student" style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                I am currently enrolled as a college or university student
              </label>
            </div>
          </div>
        );

      case 4:
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

      case 5:
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

      case 6:
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
            {form.dependents > 0 && (
              <>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginTop: '16px' }}>
                  <input
                    id="has_dependents_under_5"
                    type="checkbox"
                    checked={form.has_dependents_under_5}
                    onChange={(e) => updateField("has_dependents_under_5", e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="has_dependents_under_5" style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Do you have any dependents under age 5? (Infants/Toddlers)
                  </label>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginTop: '8px' }}>
                  <input
                    id="has_dependents_under_19"
                    type="checkbox"
                    checked={form.has_dependents_under_19}
                    onChange={(e) => updateField("has_dependents_under_19", e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="has_dependents_under_19" style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Do you have any dependents under age 19? (Children/Teens)
                  </label>
                </div>
              </>
            )}
          </div>
        );

      case 7:
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

      case 8:
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

      case 9:
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
                ["Age", form.age],
                ["Gender", form.gender ? form.gender.charAt(0).toUpperCase() + form.gender.slice(1) : "–"],
                ["Pregnant/Postpartum", form.is_pregnant ? "Yes" : "No"],
                ["College Student", form.is_student ? "Yes" : "No"],
                ["Employment", EMPLOYMENT_OPTIONS.find(o => o.value === form.employment_status)?.label || "–"],
                ["Income Range", INCOME_OPTIONS.find(o => o.value === form.income_range)?.label || "–"],
                ["Dependents", form.dependents],
                ...(form.dependents > 0 ? [
                  ["Dependents < 5 yrs", form.has_dependents_under_5 ? "Yes" : "No"],
                  ["Dependents < 19 yrs", form.has_dependents_under_19 ? "Yes" : "No"]
                ] : []),
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
          <div key={s.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
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
        {step < 9 ? (
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
