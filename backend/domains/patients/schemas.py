from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, field_validator


def mask_phi(value: Optional[str], field_type: str) -> Optional[str]:
    """Return a masked representation of a PHI field."""
    if value is None:
        return None
    if field_type == "ssn":
        digits = "".join(c for c in value if c.isdigit())
        if len(digits) >= 4:
            return f"***-**-{digits[-4:]}"
        return "***-**-****"
    if field_type == "dob":
        return "**/**/****"
    if field_type == "phone":
        digits = "".join(c for c in value if c.isdigit())
        if len(digits) >= 4:
            return f"***-***-{digits[-4:]}"
        return "***-***-****"
    return "****"


class PatientCreate(BaseModel):
    practice_id: Optional[uuid.UUID] = None
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    dob: Optional[date] = None
    sex: Optional[str] = None
    ssn: Optional[str] = None  # plain SSN, encrypted before storage
    account_type: str = "patient"
    status: str = "active"
    primary_care_provider_id: Optional[uuid.UUID] = None
    referring_provider_id: Optional[uuid.UUID] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    phone_home: Optional[str] = None
    phone_work: Optional[str] = None
    phone_cell: Optional[str] = None
    preferred_phone: Optional[str] = None
    email: Optional[str] = None
    communication_pref: Optional[str] = None
    marital_status: Optional[str] = None
    preferred_language: Optional[str] = None
    race: Optional[str] = None
    ethnicity: Optional[str] = None
    gender_identity: Optional[str] = None
    sexual_orientation: Optional[str] = None
    employment_info: Optional[Dict[str, Any]] = None
    emergency_contact: Optional[Dict[str, Any]] = None
    next_of_kin: Optional[Dict[str, Any]] = None
    user_defined_fields: Optional[Dict[str, Any]] = None
    confidential_flag: bool = False
    exempt_reporting_flag: bool = False
    no_statement_flag: bool = False
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[date] = None
    sex: Optional[str] = None
    ssn: Optional[str] = None
    status: Optional[str] = None
    primary_care_provider_id: Optional[uuid.UUID] = None
    referring_provider_id: Optional[uuid.UUID] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    phone_home: Optional[str] = None
    phone_work: Optional[str] = None
    phone_cell: Optional[str] = None
    preferred_phone: Optional[str] = None
    email: Optional[str] = None
    communication_pref: Optional[str] = None
    marital_status: Optional[str] = None
    preferred_language: Optional[str] = None
    race: Optional[str] = None
    ethnicity: Optional[str] = None
    gender_identity: Optional[str] = None
    sexual_orientation: Optional[str] = None
    employment_info: Optional[Dict[str, Any]] = None
    emergency_contact: Optional[Dict[str, Any]] = None
    next_of_kin: Optional[Dict[str, Any]] = None
    user_defined_fields: Optional[Dict[str, Any]] = None
    confidential_flag: Optional[bool] = None
    exempt_reporting_flag: Optional[bool] = None
    no_statement_flag: Optional[bool] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class PatientResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    practice_id: Optional[uuid.UUID]
    account_number: str
    first_name: str
    middle_name: Optional[str]
    last_name: str
    dob: Optional[date]
    sex: Optional[str]
    ssn_last_four: Optional[str] = None  # computed
    account_type: str
    status: str
    primary_care_provider_id: Optional[uuid.UUID]
    referring_provider_id: Optional[uuid.UUID]
    address_line1: Optional[str]
    address_line2: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip: Optional[str]
    phone_home: Optional[str]
    phone_work: Optional[str]
    phone_cell: Optional[str]
    preferred_phone: Optional[str]
    email: Optional[str]
    communication_pref: Optional[str]
    marital_status: Optional[str]
    preferred_language: Optional[str]
    race: Optional[str]
    ethnicity: Optional[str]
    gender_identity: Optional[str]
    sexual_orientation: Optional[str]
    employment_info: Optional[Dict[str, Any]]
    emergency_contact: Optional[Dict[str, Any]]
    next_of_kin: Optional[Dict[str, Any]]
    user_defined_fields: Optional[Dict[str, Any]]
    confidential_flag: bool
    exempt_reporting_flag: bool
    no_statement_flag: bool
    start_date: Optional[date]
    end_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PatientInsuranceCreate(BaseModel):
    priority: str
    payer_id: Optional[uuid.UUID] = None
    subscriber_id: Optional[str] = None
    group_number: Optional[str] = None
    plan_name: Optional[str] = None
    copay: Optional[float] = None
    deductible: Optional[float] = None
    relationship_to_insured: Optional[str] = None
    release_of_info: bool = False
    signature_on_file: bool = False
    signature_date: Optional[date] = None
    auth_number: Optional[str] = None
    auth_visits: Optional[int] = None
    auth_effective_from: Optional[date] = None
    auth_effective_to: Optional[date] = None
    is_active: bool = True


class PatientInsuranceUpdate(BaseModel):
    priority: Optional[str] = None
    payer_id: Optional[uuid.UUID] = None
    subscriber_id: Optional[str] = None
    group_number: Optional[str] = None
    plan_name: Optional[str] = None
    copay: Optional[float] = None
    deductible: Optional[float] = None
    relationship_to_insured: Optional[str] = None
    release_of_info: Optional[bool] = None
    signature_on_file: Optional[bool] = None
    signature_date: Optional[date] = None
    auth_number: Optional[str] = None
    auth_visits: Optional[int] = None
    auth_effective_from: Optional[date] = None
    auth_effective_to: Optional[date] = None
    auth_visits_used: Optional[int] = None
    is_active: Optional[bool] = None


class PatientInsuranceResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    priority: str
    payer_id: Optional[uuid.UUID]
    subscriber_id: Optional[str]
    group_number: Optional[str]
    plan_name: Optional[str]
    copay: Optional[float]
    deductible: Optional[float]
    relationship_to_insured: Optional[str]
    release_of_info: bool
    signature_on_file: bool
    signature_date: Optional[date]
    auth_number: Optional[str]
    auth_visits: Optional[int]
    auth_effective_from: Optional[date]
    auth_effective_to: Optional[date]
    auth_visits_used: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GuarantorCreate(BaseModel):
    first_name: str
    last_name: str
    relationship: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_self: bool = False


class GuarantorResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    first_name: str
    last_name: str
    relationship: Optional[str]
    address_line1: Optional[str]
    city: Optional[str]
    state: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    is_self: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class EligibilityCheckResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    patient_insurance_id: Optional[uuid.UUID]
    checked_at: datetime
    checked_by: uuid.UUID
    status: str
    coverage_active: Optional[bool]
    copay: Optional[float]
    deductible: Optional[float]
    deductible_met: Optional[float]
    out_of_pocket: Optional[float]
    error_message: Optional[str]
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BodyMapAnnotationCreate(BaseModel):
    visit_id: Optional[uuid.UUID] = None
    region_code: str
    annotation_type: str
    content: str
    severity: str = "none"
    linked_diagnosis_code: Optional[str] = None


class BodyMapAnnotationResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    visit_id: Optional[uuid.UUID]
    region_code: str
    annotation_type: str
    content: str
    severity: str
    linked_diagnosis_code: Optional[str]
    created_by: uuid.UUID
    created_at: datetime
    resolved_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PatientDeductibleTrackerResponse(BaseModel):
    id: uuid.UUID
    patient_insurance_id: uuid.UUID
    calendar_year: int
    deductible_amount: float
    amount_met: float
    updated_at: datetime

    model_config = {"from_attributes": True}
