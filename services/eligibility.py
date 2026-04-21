"""
Rule-based eligibility pre-filtering for AidNavigator AI.

Applies deterministic rules BEFORE the LLM to narrow down
which programs a user might be eligible for.
"""

from models.schemas import UserProfile


def _parse_income_midpoint(income_range: str) -> int:
    """Parse the midpoint of an income range string."""
    if income_range == "100001+":
        return 120000
    parts = income_range.replace(",", "").split("-")
    if len(parts) == 2:
        return (int(parts[0]) + int(parts[1])) // 2
    return 0


def _household_size(profile: UserProfile) -> int:
    return 1 + profile.dependents


def _fpl_for_size(household_size: int) -> int:
    """2025 Federal Poverty Level."""
    return 15650 + 5500 * max(0, household_size - 1)


def check_snap(profile: UserProfile) -> dict:
    income = _parse_income_midpoint(profile.income_range)
    hh = _household_size(profile)
    fpl = _fpl_for_size(hh)
    t130 = int(fpl * 1.30)
    eligible = income <= t130
    reasons = []
    if eligible:
        reasons.append(f"Income (~${income:,}/yr) ≤ 130% FPL (${t130:,}) for household of {hh}.")
    else:
        reasons.append(f"Income (~${income:,}/yr) exceeds 130% FPL (${t130:,}) for household of {hh}.")
    if profile.disability_status and profile.disability_status not in ("none", "prefer_not_to_say"):
        t200 = int(fpl * 2.0)
        reasons.append("Disabled members may qualify under relaxed rules (up to 200% FPL).")
        if not eligible and income <= t200:
            eligible = True
    return {"program": "SNAP", "eligible": eligible, "reasons": reasons}


def check_medicaid(profile: UserProfile) -> dict:
    income = _parse_income_midpoint(profile.income_range)
    hh = _household_size(profile)
    fpl = _fpl_for_size(hh)
    t138 = int(fpl * 1.38)
    eligible = income <= t138
    reasons = []
    if eligible:
        reasons.append(f"Income (~${income:,}/yr) ≤ 138% FPL (${t138:,}) in expansion states.")
    else:
        reasons.append(f"Income (~${income:,}/yr) exceeds 138% FPL (${t138:,}).")
    if profile.dependents > 0:
        t200 = int(fpl * 2.0)
        reasons.append("Children may qualify for Medicaid/CHIP at 200-300% FPL.")
        if not eligible and income <= t200:
            eligible = True
    if profile.disability_status and profile.disability_status not in ("none", "prefer_not_to_say"):
        reasons.append("Disabled individuals may qualify through SSI-related pathways.")
        eligible = True
    return {"program": "Medicaid", "eligible": eligible, "reasons": reasons}


def check_section8(profile: UserProfile) -> dict:
    income = _parse_income_midpoint(profile.income_range)
    hh = _household_size(profile)
    ami_50 = {1: 35000, 2: 40000, 3: 45000, 4: 50000, 5: 54000, 6: 58000, 7: 62000, 8: 66000}
    threshold = ami_50.get(min(hh, 8), 66000)
    eligible = income <= threshold
    reasons = []
    if eligible:
        reasons.append(f"Income (~${income:,}/yr) below 50% AMI (~${threshold:,}) for household of {hh}.")
    else:
        reasons.append(f"Income (~${income:,}/yr) may exceed 50% AMI (~${threshold:,}).")
    if profile.housing_status in ("homeless", "temporary_shelter"):
        reasons.append("Homeless/shelter residents receive priority for Section 8.")
        eligible = True
    elif profile.housing_status == "renting":
        reasons.append("Current renters are eligible to apply.")
    if profile.disability_status and profile.disability_status not in ("none", "prefer_not_to_say"):
        reasons.append("Disabled persons often receive waitlist priority.")
    return {"program": "Section 8 Housing", "eligible": eligible, "reasons": reasons}


def check_tanf(profile: UserProfile) -> dict:
    income = _parse_income_midpoint(profile.income_range)
    hh = _household_size(profile)
    if profile.dependents == 0:
        return {"program": "TANF", "eligible": False, "reasons": ["TANF requires a minor child in household."]}
    thresholds = {2: 12000, 3: 15000, 4: 18000, 5: 21000, 6: 24000, 7: 27000, 8: 30000}
    t = thresholds.get(min(hh, 8), 30000)
    eligible = income <= t
    reasons = []
    if eligible:
        reasons.append(f"Income (~${income:,}/yr) below typical TANF limits for family of {hh}.")
    else:
        reasons.append(f"Income (~${income:,}/yr) may exceed TANF limits in many states.")
        if income <= t * 1.5:
            eligible = True
            reasons.append("Some states (CA, AK) have higher limits — depends on state.")
    if profile.employment_status == "unemployed":
        reasons.append("Unemployment may strengthen TANF eligibility.")
    return {"program": "TANF", "eligible": eligible, "reasons": reasons}


def check_liheap(profile: UserProfile) -> dict:
    income = _parse_income_midpoint(profile.income_range)
    hh = _household_size(profile)
    fpl = _fpl_for_size(hh)
    t150 = int(fpl * 1.50)
    eligible = income <= t150
    reasons = []
    if eligible:
        reasons.append(f"Income (~${income:,}/yr) ≤ 150% FPL (${t150:,}) for household of {hh}.")
    else:
        reasons.append(f"Income (~${income:,}/yr) exceeds 150% FPL (${t150:,}).")
    if profile.housing_status in ("renting", "own_home"):
        reasons.append("Both renters and homeowners can apply for LIHEAP.")
    priority = []
    if profile.disability_status and profile.disability_status not in ("none", "prefer_not_to_say"):
        priority.append("disabled members")
    if profile.dependents > 0:
        priority.append("young children")
    if priority:
        reasons.append(f"Households with {', '.join(priority)} receive LIHEAP priority.")
    reasons.append("SNAP/SSI/TANF recipients may auto-qualify (categorical eligibility).")
    return {"program": "LIHEAP", "eligible": eligible, "reasons": reasons}


def run_eligibility_filters(profile: UserProfile) -> list[dict]:
    """Run all checks, return eligible programs."""
    checks = [check_snap(profile), check_medicaid(profile), check_section8(profile), check_tanf(profile), check_liheap(profile)]
    return [c for c in checks if c["eligible"]]
