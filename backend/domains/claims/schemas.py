from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ClaimLineResponse(BaseModel):
    id: uuid.UUID
    claim_id: uuid.UUID
    cpt_code: str
    modifiers: Optional[List[str]]
    units: int
    charge_amount: float
    allowed_amount: Optional[float]
    paid_amount: Optional[float]
    adjustment_amount: Optional[float]
    revenue_code: Optional[str]
    sequence: int
    diagnosis_pointers: Optional[List[int]]
    model_config = {"from_attributes": True}


class ClaimValidationIssueResponse(BaseModel):
    id: uuid.UUID
    severity: str
    code: str
    message: str
    field_path: Optional[str]
    line_sequence: Optional[int]
    resolved: bool
    model_config = {"from_attributes": True}


class ClaimCreate(BaseModel):
    patient_id: uuid.UUID
    visit_id: Optional[uuid.UUID] = None
    provider_id: Optional[uuid.UUID] = None
    billing_provider_id: Optional[uuid.UUID] = None
    payer_id: Optional[uuid.UUID] = None
    patient_insurance_id: Optional[uuid.UUID] = None
    claim_type: str = "professional"
    date_of_service: Optional[date] = None
    admit_date: Optional[date] = None
    discharge_date: Optional[date] = None
    admit_code: Optional[str] = None
    discharge_code: Optional[str] = None
    total_charge: float = 0
    authorization_number: Optional[str] = None
    diagnoses_snapshot: Optional[List[Dict]] = None


class ClaimUpdate(BaseModel):
    provider_id: Optional[uuid.UUID] = None
    payer_id: Optional[uuid.UUID] = None
    status: Optional[str] = None
    authorization_number: Optional[str] = None
    payer_claim_number: Optional[str] = None
    admit_code: Optional[str] = None
    discharge_code: Optional[str] = None


class ClaimResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    claim_number: Optional[str]
    patient_control_number: str
    patient_id: uuid.UUID
    visit_id: Optional[uuid.UUID]
    provider_id: Optional[uuid.UUID]
    payer_id: Optional[uuid.UUID]
    payer_name: Optional[str] = None
    patient_name: Optional[str] = None
    claim_type: str
    date_of_service: Optional[date]
    admit_date: Optional[date]
    discharge_date: Optional[date]
    admit_code: Optional[str]
    discharge_code: Optional[str]
    total_charge: float
    total_paid: float
    balance: float
    status: str
    validation_status: str
    authorization_number: Optional[str]
    payer_claim_number: Optional[str]
    last_submitted_at: Optional[datetime]
    lines: List[ClaimLineResponse] = []
    validation_issues: List[ClaimValidationIssueResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        instance = super().model_validate(obj, *args, **kwargs)
        instance.patient_control_number = str(obj.id)
        return instance


class ClaimLifecycleEvent(BaseModel):
    id: uuid.UUID
    claim_id: uuid.UUID
    from_status: Optional[str]
    to_status: str
    changed_by: Optional[uuid.UUID]
    note: Optional[str]
    changed_at: datetime
    model_config = {"from_attributes": True}


class BatchSubmitRequest(BaseModel):
    claim_ids: List[uuid.UUID]
    clearinghouse: Optional[str] = None


class CMS1500Preview(BaseModel):
    claim_id: str
    patient_control_number: str
    claim_number: Optional[str]
    patient_name: str
    date_of_birth: Optional[date]
    insured_id: Optional[str]
    payer_name: Optional[str]
    provider_name: Optional[str]
    provider_npi: Optional[str]
    date_of_service: Optional[date]
    place_of_service: Optional[str]
    diagnosis_codes: List[str]
    service_lines: List[Dict[str, Any]]
    total_charge: float
