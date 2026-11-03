"""Pydantic request and response schemas for Justice AI API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CaseInput(BaseModel):
    """Legacy feature input schema for direct feature testing."""
    state_code: int = Field(..., description="Numeric State Code from DDL")
    dist_code: int = Field(..., description="Numeric District Code")
    court_no: int = Field(default=1, description="Court Number in Complex")
    act_code: Optional[int] = Field(default=17332, description="Act Key Code (e.g. IPC)")
    section: Optional[int] = Field(default=302, description="Primary Section (e.g. IPC Section)")
    bailable_ipc: int = Field(default=0, description="1 if Bailable, 0 if Non-Bailable")
    number_sections_category: str = Field(default="1 to 2", description="Number of Sections Category")
    filing_judge_tenure_months: float = Field(default=12.0, description="Presiding judge tenure at filing in months")
    case_type_code: int = Field(default=1, description="Case Type Key Code")


class FeatureContribution(BaseModel):
    feature: str
    impact: str
    direction: str = "increase_delay"
    description: Optional[str] = None


class PredictionResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    status: str
    message: Optional[str] = None
    model_trained: bool = True
    predicted_class: Optional[str] = None
    delay_risk_pct: Optional[float] = None
    ontime_confidence_pct: Optional[float] = None
    routed_regressor: Optional[str] = None
    predicted_duration_months: Optional[float] = None
    duration_range_months: Optional[List[float]] = None
    uncertainty: Optional[Dict[str, Any]] = None
    top_features: Optional[List[FeatureContribution]] = None
    source: Optional[str] = None


class CodebookItem(BaseModel):
    code: int
    name: str


class AuthRequest(BaseModel):
    email: str
    password: str


class CaseRecordCreate(BaseModel):
    case_details: Dict[str, Any]
    forecast: Dict[str, Any]
    prediction_mode: str = "unknown"


class OutcomeUpdate(BaseModel):
    actual_duration_months: float = Field(..., gt=0, le=1200)
    actual_disposition_date: Optional[str] = None
    actual_disposition: Optional[str] = None
    outcome_note: Optional[str] = Field(default=None, max_length=2000)


class ModelInfoResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    architecture: str
    stages: List[str]
    trained_models: Dict[str, bool]
    training_data_coverage: str
    paper_citation: str


# ==========================================
# New Schemas for Case Upload & Full Analysis
# ==========================================

class TextExtractRequest(BaseModel):
    """Request schema for extracting from pasted text."""
    raw_text: str = Field(..., description="Raw text of the legal document or case description")
    redact_pii: bool = Field(default=False, description="Whether to redact personal information in memory")


class CaseAnalysisRequest(BaseModel):
    """Request schema containing reviewed & confirmed case details for full 7-section analysis."""
    case_title: str = Field(default="State vs Accused")
    case_number: Optional[str] = Field(default=None)
    filing_year: int = Field(default=2024)
    state: str = Field(default="Maharashtra")
    state_code: int = Field(default=1)
    district: str = Field(default="Pune")
    dist_code: int = Field(default=1)
    court_name: str = Field(default="District & Sessions Court")
    court_no: int = Field(default=1)
    act: str = Field(default="The Indian Penal Code")
    sections: List[str] = Field(default_factory=lambda: ["379"])
    case_type: str = Field(default="Criminal Case")
    judge_position: str = Field(default="Civil Judge Junior Division")
    judge_tenure_months: float = Field(default=12.0)
    accused_count: int = Field(default=1)
    custody_status: str = Field(default="Not Arrested")
    case_summary: Optional[str] = Field(default=None)


class CaseAnalysisResponse(BaseModel):
    """Full 7-section citizen-friendly case analysis output."""
    model_config = {"protected_namespaces": ()}

    # Section 1: Case at a Glance
    glance: Dict[str, Any]

    # Section 2: Expected Duration & Delay Risk
    duration_prediction: Dict[str, Any]

    # Section 3: Why It May Be Delayed
    delay_drivers: List[Dict[str, Any]]

    # Section 4: Similar Past Cases
    similar_cases: Dict[str, Any]

    # Section 5: Bail Assessment & Timelines
    bail_assessment: Dict[str, Any]

    # Section 6: Procedural Roadmap (What happens next)
    procedural_roadmap: List[Dict[str, Any]]

    # Section 7: About this Estimate & Data Integrity Note
    integrity_disclosure: Dict[str, Any]
