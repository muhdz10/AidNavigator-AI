"""
Pydantic data schemas for AidNavigator AI.
Defines all structured data types used across the application.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class UserProfile(BaseModel):
    """Structured user intake profile."""

    location: str = Field(..., description="U.S. state of residence")
    age: int = Field(..., ge=0, le=120, description="Age of the applicant")
    gender: str = Field(..., description="Gender of the applicant (e.g., male, female, non-binary, prefer_not_to_say)")
    employment_status: str = Field(
        ...,
        description="Current employment status",
    )
    is_student: bool = Field(default=False, description="Is the applicant currently enrolled as a student?")
    income_range: str = Field(
        ...,
        description="Annual household income range",
    )
    dependents: int = Field(
        ..., ge=0, le=20, description="Number of dependents in household"
    )
    has_dependents_under_5: bool = Field(default=False, description="Does the applicant have dependents under age 5?")
    has_dependents_under_19: bool = Field(default=False, description="Does the applicant have dependents under age 19?")
    housing_status: str = Field(
        ...,
        description="Current housing situation",
    )
    disability_status: Optional[str] = Field(
        None,
        description="Disability status (optional)",
    )
    is_pregnant: bool = Field(default=False, description="Is the applicant currently pregnant or postpartum?")


class IntakeRequest(BaseModel):
    """Request body for the intake endpoint."""

    profile: UserProfile
    additional_info: Optional[str] = Field(
        None, max_length=500, description="Any additional context (optional)"
    )


class EligibilityRequest(BaseModel):
    """Request body for the eligibility endpoint."""

    session_id: str
    profile: UserProfile
    additional_info: Optional[str] = None


class Program(BaseModel):
    """A single suggested benefit program."""

    name: str = Field(..., description="Official program name")
    reason: str = Field(..., description="Why this program was suggested")
    documents_required: list[str] = Field(
        ..., description="Documents needed to apply"
    )


class Source(BaseModel):
    """A policy document source with its URL."""
    name: str
    url: str


class EligibilityResponse(BaseModel):
    """Structured response from the eligibility endpoint."""

    session_id: str
    programs: list[Program]
    disclaimer: str = (
        "This is not a guarantee of eligibility. Final approval depends on "
        "the official agency. Please contact your local office to confirm "
        "eligibility and begin the application process."
    )
    sources: list[Source] = Field(
        ..., description="Policy document sources used in analysis"
    )


class TraceLog(BaseModel):
    """A single trace log entry for debugging and auditing."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    timestamp: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z"
    )
    original_input: Optional[str] = None
    sanitized_input: Optional[str] = None
    profile: Optional[dict] = None
    retrieved_chunks: Optional[list[str]] = None
    final_prompt: Optional[str] = None
    output: Optional[dict] = None
    flags: list[str] = Field(default_factory=list)
    blocked: bool = False
    error: Optional[str] = None
