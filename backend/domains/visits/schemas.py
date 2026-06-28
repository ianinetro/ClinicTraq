from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, computed_field


class VisitCreate(BaseModel):
    patient_id: uuid.UUID
    practice_id: Optional[uuid.UUID] = None
    office_id: Optional[uuid.UUID] = None
    facility_id: Optional[uuid.UUID] = None
    provider_id: Optional[uuid.UUID] = None
    billing_provider_id: Optional[uuid.UUID] = None
    rendering_provider_id: Optional[uuid.UUID] = None
    visit_date: date
    visit_type: Optional[str] = None
    reason: Optional[str] = None
    chief_complaint: Optional[str] = None
    allergies: Optional[str] = None
    status: str = "open"
    print_statement_flag: bool = True
    vital_signs: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    assigned_user_id: Optional[uuid.UUID] = None


class VisitUpdate(BaseModel):
    office_id: Optional[uuid.UUID] = None
    facility_id: Optional[uuid.UUID] = None
    provider_id: Optional[uuid.UUID] = None
    billing_provider_id: Optional[uuid.UUID] = None
    rendering_provider_id: Optional[uuid.UUID] = None
    visit_date: Optional[date] = None
    visit_type: Optional[str] = None
    reason: Optional[str] = None
    chief_complaint: Optional[str] = None
    allergies: Optional[str] = None
    status: Optional[str] = None
    print_statement_flag: Optional[bool] = None
    vital_signs: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    assigned_user_id: Optional[uuid.UUID] = None


class VisitResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    patient_id: uuid.UUID
    practice_id: Optional[uuid.UUID]
    office_id: Optional[uuid.UUID]
    facility_id: Optional[uuid.UUID]
    provider_id: Optional[uuid.UUID]
    billing_provider_id: Optional[uuid.UUID]
    rendering_provider_id: Optional[uuid.UUID]
    visit_date: date
    visit_type: Optional[str]
    reason: Optional[str]
    chief_complaint: Optional[str]
    allergies: Optional[str]
    status: str
    print_statement_flag: bool
    vital_signs: Optional[Dict[str, Any]]
    notes: Optional[str]
    assigned_user_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VisitDiagnosisCreate(BaseModel):
    code_type: str = "ICD-10"
    diagnosis_code: str
    description: Optional[str] = None
    pointer_label: str
    sequence: int


class VisitDiagnosisResponse(BaseModel):
    id: uuid.UUID
    visit_id: uuid.UUID
    code_type: str
    diagnosis_code: str
    description: Optional[str]
    pointer_label: str
    sequence: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ChargeLineCreate(BaseModel):
    sequence: int
    dos_from: date
    dos_to: date
    pos: str
    cpt_code: str
    description: Optional[str] = None
    modifier_a: Optional[str] = None
    modifier_b: Optional[str] = None
    modifier_c: Optional[str] = None
    modifier_d: Optional[str] = None
    icd_pointers: Optional[str] = None
    charge: float
    units: int = 1
    insurance_payment: float = 0
    patient_payment: float = 0
    adjustment: float = 0
    line_note: Optional[str] = None
    anesthesia_fields: Optional[Dict[str, Any]] = None
    ndc_qualifier: Optional[str] = None
    ndc_code: Optional[str] = None
    ndc_unit_price: Optional[float] = None
    ndc_quantity: Optional[float] = None
    ndc_qualifier_unit: Optional[str] = None


class ChargeLineUpdate(BaseModel):
    sequence: Optional[int] = None
    dos_from: Optional[date] = None
    dos_to: Optional[date] = None
    pos: Optional[str] = None
    cpt_code: Optional[str] = None
    description: Optional[str] = None
    modifier_a: Optional[str] = None
    modifier_b: Optional[str] = None
    modifier_c: Optional[str] = None
    modifier_d: Optional[str] = None
    icd_pointers: Optional[str] = None
    charge: Optional[float] = None
    units: Optional[int] = None
    insurance_payment: Optional[float] = None
    patient_payment: Optional[float] = None
    adjustment: Optional[float] = None
    line_note: Optional[str] = None


class ChargeLineResponse(BaseModel):
    id: uuid.UUID
    visit_id: uuid.UUID
    sequence: int
    dos_from: date
    dos_to: date
    pos: str
    cpt_code: str
    description: Optional[str]
    modifier_a: Optional[str]
    modifier_b: Optional[str]
    modifier_c: Optional[str]
    modifier_d: Optional[str]
    icd_pointers: Optional[str]
    charge: float
    units: int
    insurance_payment: float
    patient_payment: float
    adjustment: float
    balance: float
    line_note: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        instance.balance = float(obj.balance)
        return instance


class VisitBillingOptionsCreate(BaseModel):
    referring_provider_id: Optional[uuid.UUID] = None
    supervising_provider_id: Optional[uuid.UUID] = None
    ordering_provider_id: Optional[uuid.UUID] = None
    prior_auth_number: Optional[str] = None
    employment_related: bool = False
    auto_accident: bool = False
    auto_accident_state: Optional[str] = None
    other_accident: bool = False
    onset_date: Optional[date] = None
    hospitalization_from: Optional[date] = None
    hospitalization_to: Optional[date] = None
    initial_treatment_date: Optional[date] = None
    last_seen_date: Optional[date] = None
    accident_date: Optional[date] = None
    medicaid_resubmission_code: Optional[str] = None
    original_ref_number: Optional[str] = None
    clia_number: Optional[str] = None
    mammography_cert: Optional[str] = None
    delay_reason_code: Optional[str] = None
    ambulance_fields: Optional[Dict[str, Any]] = None
    attachment_fields: Optional[Dict[str, Any]] = None
    hospice_employee: bool = False
    referral_number: Optional[str] = None
    contract_fields: Optional[Dict[str, Any]] = None


class VisitBillingOptionsUpdate(VisitBillingOptionsCreate):
    pass


class VisitBillingOptionsResponse(BaseModel):
    id: uuid.UUID
    visit_id: uuid.UUID
    referring_provider_id: Optional[uuid.UUID]
    supervising_provider_id: Optional[uuid.UUID]
    ordering_provider_id: Optional[uuid.UUID]
    prior_auth_number: Optional[str]
    employment_related: bool
    auto_accident: bool
    auto_accident_state: Optional[str]
    other_accident: bool
    onset_date: Optional[date]
    hospitalization_from: Optional[date]
    hospitalization_to: Optional[date]
    initial_treatment_date: Optional[date]
    last_seen_date: Optional[date]
    accident_date: Optional[date]
    medicaid_resubmission_code: Optional[str]
    original_ref_number: Optional[str]
    clia_number: Optional[str]
    mammography_cert: Optional[str]
    delay_reason_code: Optional[str]
    ambulance_fields: Optional[Dict[str, Any]]
    attachment_fields: Optional[Dict[str, Any]]
    hospice_employee: bool
    referral_number: Optional[str]
    contract_fields: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VisitNoteCreate(BaseModel):
    note: str


class VisitNoteResponse(BaseModel):
    id: uuid.UUID
    visit_id: uuid.UUID
    author_id: uuid.UUID
    note: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BillingIssue(BaseModel):
    severity: str  # "error" | "warning" | "info"
    field: str
    message: str
    suggestion: str = ""


class VitalSignsCreate(BaseModel):
    visit_id: uuid.UUID
    patient_id: uuid.UUID
    height_in: Optional[float] = None
    weight_lbs: Optional[float] = None
    bmi: Optional[float] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    respiratory_rate: Optional[int] = None
    temperature_f: Optional[float] = None
    o2_sat: Optional[int] = None
    pain_scale: Optional[int] = None
    recorded_at: Optional[datetime] = None


class VitalSignsResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    visit_id: uuid.UUID
    patient_id: uuid.UUID
    height_in: Optional[float]
    weight_lbs: Optional[float]
    bmi: Optional[float]
    systolic_bp: Optional[int]
    diastolic_bp: Optional[int]
    heart_rate: Optional[int]
    respiratory_rate: Optional[int]
    temperature_f: Optional[float]
    o2_sat: Optional[int]
    pain_scale: Optional[int]
    recorded_by: Optional[uuid.UUID]
    recorded_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    visit_id: uuid.UUID
    patient_id: uuid.UUID
    order_type: str
    description: str
    priority: str = "routine"
    notes: Optional[str] = None
    external_ref: Optional[str] = None
    ordered_at: Optional[datetime] = None


class OrderResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    visit_id: uuid.UUID
    patient_id: uuid.UUID
    order_type: str
    description: str
    priority: str
    status: str
    ordered_by: Optional[uuid.UUID]
    ordered_at: Optional[datetime]
    notes: Optional[str]
    external_ref: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
