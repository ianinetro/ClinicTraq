from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ChargeLineCreate(BaseModel):
    cpt_code: str
    cpt_code_id: Optional[uuid.UUID] = None
    modifiers: Optional[List[str]] = None
    units: int = 1
    charge_amount: float
    revenue_code: Optional[str] = None
    diagnosis_pointers: Optional[List[int]] = None


class ChargeLineResponse(BaseModel):
    id: uuid.UUID
    visit_id: uuid.UUID
    cpt_code: str
    modifiers: Optional[List[str]]
    units: int
    charge_amount: float
    allowed_amount: Optional[float]
    revenue_code: Optional[str]
    sequence: int
    model_config = {"from_attributes": True}


class VisitDiagnosisCreate(BaseModel):
    icd_code: str
    diagnosis_code_id: Optional[uuid.UUID] = None
    sequence: int = 1
    is_primary: bool = False
    poa: Optional[str] = None


class VisitDiagnosisResponse(BaseModel):
    id: uuid.UUID
    visit_id: uuid.UUID
    icd_code: str
    sequence: int
    is_primary: bool
    poa: Optional[str]
    model_config = {"from_attributes": True}


class VisitBillingOptionsCreate(BaseModel):
    primary_insurance_id: Optional[uuid.UUID] = None
    secondary_insurance_id: Optional[uuid.UUID] = None
    billing_provider_id: Optional[uuid.UUID] = None
    referring_provider_id: Optional[uuid.UUID] = None
    authorization_number: Optional[str] = None
    referral_number: Optional[str] = None
    hold_claim: bool = False
    accident_related: bool = False
    accident_date: Optional[date] = None
    accident_state: Optional[str] = None


class VisitCreate(BaseModel):
    patient_id: uuid.UUID
    provider_id: Optional[uuid.UUID] = None
    office_id: Optional[uuid.UUID] = None
    facility_id: Optional[uuid.UUID] = None
    date_of_service: date
    admit_date: Optional[date] = None
    discharge_date: Optional[date] = None
    admit_code: Optional[str] = None
    discharge_code: Optional[str] = None
    claim_type: str = "professional"
    visit_type: Optional[str] = None
    place_of_service_code: Optional[str] = None
    chief_complaint: Optional[str] = None
    vital_signs: Optional[Dict[str, Any]] = None
    diagnoses: List[VisitDiagnosisCreate] = []
    charge_lines: List[ChargeLineCreate] = []
    billing_options: Optional[VisitBillingOptionsCreate] = None


class VisitUpdate(BaseModel):
    provider_id: Optional[uuid.UUID] = None
    date_of_service: Optional[date] = None
    admit_date: Optional[date] = None
    discharge_date: Optional[date] = None
    admit_code: Optional[str] = None
    discharge_code: Optional[str] = None
    status: Optional[str] = None
    chief_complaint: Optional[str] = None
    vital_signs: Optional[Dict[str, Any]] = None


class VisitResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    patient_id: uuid.UUID
    provider_id: Optional[uuid.UUID]
    office_id: Optional[uuid.UUID]
    date_of_service: date
    admit_date: Optional[date]
    discharge_date: Optional[date]
    admit_code: Optional[str]
    discharge_code: Optional[str]
    claim_type: str
    status: str
    visit_type: Optional[str]
    place_of_service_code: Optional[str]
    chief_complaint: Optional[str]
    vital_signs: Optional[Dict[str, Any]]
    superbill_generated: bool
    diagnoses: List[VisitDiagnosisResponse] = []
    charge_lines: List[ChargeLineResponse] = []
    created_at: datetime
    model_config = {"from_attributes": True}


class BillingValidationIssue(BaseModel):
    severity: str  # error | warning | info
    code: str
    message: str


class BillingValidationResponse(BaseModel):
    valid: bool
    issues: List[BillingValidationIssue]
