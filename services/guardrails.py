"""
Guardrails module for AidNavigator AI.

Implements multi-layer protection:
1. Input sanitization — detects prompt injection and malicious input
2. Output validation — ensures safety constraints in LLM responses
"""

import re
from dataclasses import dataclass, field


# ── Injection detection patterns ──────────────────────────────────────────────

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous\s+)?instructions",
    r"ignore\s+the\s+above",
    r"disregard\s+(all\s+)?(previous\s+)?instructions",
    r"override\s+(the\s+)?system",
    r"pretend\s+(you\s+are|to\s+be|you're)",
    r"act\s+as\s+(if|though)",
    r"forget\s+(everything|previous|all)",
    r"you\s+are\s+now\s+a",
    r"new\s+instructions",
    r"system\s*prompt",
    r"do\s+not\s+follow",
    r"bypass\s+(the\s+)?rules",
    r"jailbreak",
    r"dan\s+mode",
    r"developer\s+mode",
    r"reveal\s+(your|the)\s+(system|instructions|prompt)",
    r"what\s+are\s+your\s+instructions",
    r"repeat\s+(the|your)\s+(system|initial)\s+(prompt|instructions)",
]

# ── Fraud-related patterns ────────────────────────────────────────────────────

FRAUD_PATTERNS = [
    r"fake\s+document",
    r"forge(d|ry)?\s+",
    r"falsif(y|ied|ication)",
    r"how\s+to\s+lie",
    r"cheat\s+the\s+system",
    r"get\s+benefits\s+illegally",
    r"fraud(ulent)?",
    r"make\s+fake",
    r"create\s+false",
    r"fabricat(e|ed|ing)",
]

# ── Output confidence patterns to flag ────────────────────────────────────────

OVERCONFIDENT_PATTERNS = [
    (r"\byou\s+will\s+definitely\b", "you may"),
    (r"\byou\s+are\s+guaranteed\b", "you may be eligible"),
    (r"\bguaranteed\s+eligibility\b", "potential eligibility"),
    (r"\bguaranteed\s+to\s+(receive|get|qualify)\b", "may be eligible to"),
    (r"\b100%\s+(eligible|qualified|certain)\b", "potentially eligible"),
    (r"\bcertainly\s+eligible\b", "potentially eligible"),
    (r"\bcertainly\s+qualify\b", "may qualify"),
    (r"\byou\s+are\s+eligible\b", "you may be eligible"),
    (r"\byou\s+qualify\b", "you may qualify"),
    (r"\bwill\s+receive\s+benefits\b", "may be eligible for benefits"),
    (r"\bapproval\s+is\s+certain\b", "approval depends on the official agency"),
]

# ── HTML/script patterns ─────────────────────────────────────────────────────

DANGEROUS_HTML_PATTERN = re.compile(
    r"<\s*(script|iframe|object|embed|form|style|link|meta|base)\b",
    re.IGNORECASE,
)


@dataclass
class SanitizationResult:
    """Result of input sanitization."""

    sanitized_text: str
    flags: list[str] = field(default_factory=list)
    blocked: bool = False
    reason: str | None = None


@dataclass
class ValidationResult:
    """Result of output validation."""

    validated_text: str
    modifications: list[str] = field(default_factory=list)
    disclaimer_present: bool = False


def sanitize_input(text: str | None, max_length: int = 500) -> SanitizationResult:
    """
    Sanitize user input for safety.

    Checks for:
    - Prompt injection attempts
    - Fraud-related content
    - HTML/script injection
    - Excessive length

    Returns a SanitizationResult with cleaned text and any flags.
    """
    if text is None or text.strip() == "":
        return SanitizationResult(sanitized_text="", flags=[], blocked=False)

    flags = []
    blocked = False
    reason = None
    cleaned = text.strip()

    # ── Length check ───────────────────────────────────────────────────────
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
        flags.append(f"INPUT_TRUNCATED: Input exceeded {max_length} characters")

    # ── HTML/Script stripping ─────────────────────────────────────────────
    if DANGEROUS_HTML_PATTERN.search(cleaned):
        cleaned = re.sub(r"<[^>]+>", "", cleaned)
        flags.append("HTML_STRIPPED: Potentially dangerous HTML tags removed")

    # ── Prompt injection detection ────────────────────────────────────────
    text_lower = cleaned.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text_lower):
            blocked = True
            reason = "INJECTION_DETECTED: Input contains prompt injection attempt"
            flags.append(reason)
            break

    # ── Fraud detection ───────────────────────────────────────────────────
    if not blocked:
        for pattern in FRAUD_PATTERNS:
            if re.search(pattern, text_lower):
                blocked = True
                reason = "FRAUD_DETECTED: Input contains fraud-related content"
                flags.append(reason)
                break

    return SanitizationResult(
        sanitized_text="" if blocked else cleaned,
        flags=flags,
        blocked=blocked,
        reason=reason,
    )


def validate_output(text: str) -> ValidationResult:
    """
    Validate and post-process LLM output for safety.

    Ensures:
    - No overconfident eligibility claims
    - Disclaimer is present or added
    - No unsupported absolute statements

    Returns a ValidationResult with cleaned text and modification notes.
    """
    modifications = []
    validated = text

    # ── Replace overconfident language ────────────────────────────────────
    for pattern, replacement in OVERCONFIDENT_PATTERNS:
        if re.search(pattern, validated, re.IGNORECASE):
            validated = re.sub(pattern, replacement, validated, flags=re.IGNORECASE)
            modifications.append(
                f"CONFIDENCE_REDUCED: Replaced overconfident language matching '{pattern}'"
            )

    # ── Check for disclaimer ──────────────────────────────────────────────
    disclaimer_keywords = [
        "not a guarantee",
        "official agency",
        "final approval",
        "verify eligibility",
        "not guaranteed",
        "contact your local",
    ]
    disclaimer_present = any(kw in validated.lower() for kw in disclaimer_keywords)

    if not disclaimer_present:
        modifications.append("DISCLAIMER_MISSING: Output lacks eligibility disclaimer")

    return ValidationResult(
        validated_text=validated,
        modifications=modifications,
        disclaimer_present=disclaimer_present,
    )


def validate_profile_fields(profile_dict: dict) -> list[str]:
    """
    Validate that profile fields don't contain injection attempts.
    Returns a list of flags for any suspicious field values.
    """
    flags = []
    
    # Custom validation for new fields
    age = profile_dict.get("age")
    if age is not None:
        try:
            age_int = int(age)
            if age_int < 0 or age_int > 120:
                flags.append("FIELD_AGE: Age is outside realistic bounds (0-120)")
        except ValueError:
            flags.append("FIELD_AGE: Age must be a number")
            
    gender = profile_dict.get("gender")
    valid_genders = ["male", "female", "non-binary", "prefer_not_to_say"]
    if gender and isinstance(gender, str) and gender.lower() not in valid_genders:
        flags.append(f"FIELD_GENDER: Invalid gender option '{gender}'")

    for field_name, value in profile_dict.items():
        if isinstance(value, str) and len(value) > 2:
            result = sanitize_input(value, max_length=200)
            if result.flags:
                flags.extend(
                    [f"FIELD_{field_name.upper()}: {f}" for f in result.flags]
                )
    return flags
