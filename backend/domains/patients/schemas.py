from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, field_validator, model_serializer


def _mask_ssn(ssn: Optional[str]) -> Optional[str]:
    """Return masked SSN showing only last 4 digits."""
    if not ssn:
        return None
    # Strip non-digit characters for length check
    digits = "".join(c for c in ssn if c.isdigit())
    if len(digits) < 4:
        return "•••-••-????"
    last4 = digits[-4:]
    return f"•••-••-{last4}"


class PatientCreate(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    suffix: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone_home: Optional[str] = None
    phone_cell: Optional[str] = None
    phone_work: Optional[str] = None
    email: Optional[str] = None
    ssn: Optional[str] = None  # plain text input; encrypted before storage
    mrn: Optional[str] = None
    primary_language: Optional[str] = None
    race: Optional[str] = None
    ethnicity: Optional[str] = None


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone_home: Optional[str] = None
    phone_cell: Optional[str] = None
    email: Optional[str] = None
    ssn: Optional[str] = None
    is_active: Optional[bool] = None


class PatientResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    first_name: str
    middle_name: Optional[str]
    last_name: str
    date_of_birth: Optional[date]
    gender: Optional[str]
    address_line1: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip_code: Optional[str]
    phone_home: Optional[str]
    phone_cell: Optional[str]
    email: Optional[str]
    ssn_masked: Optional[str] = None  # populated by validator
    mrn: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_masking(cls, patient, decrypted_ssn: Optional[str] = None):
        data = {
            "id": patient.id,
            "tenant_id": patient.tenant_id,
            "first_name": patient.first_name,
            "middle_name": patient.middle_name,
            "last_name": patient.last_name,
            "date_of_birth": patient.date_of_birth,
            "gender": patient.gender,
            "address_line1": patient.address_line1,
            "city": patient.city,
            "state": patient.state,
            "zip_code": patient.zip_code,
            "phone_home": patient.phone_home,
            "phone_cell": patient.phone_cell,
            "email": patient.email,
            "ssn_masked": _mask_ssn(decrypted_ssn),
            "mrn": patient.mrn,
            "is_active": patient.is_active,
            "created_at": patient.created_at,
        }
        return cls(**data)


class PatientInsuranceCreate(BaseModel):
    payer_id: uuid.UUID
    priority: int = 1
    member_id: str
    group_number: Optional[str] = None
    plan_name: Optional[str] = None
    subscriber_first_name: Optional[str] = None
    subscriber_last_name: Optional[str] = None
    subscriber_dob: Optional[date] = None
    subscriber_gender: Optional[str] = None
    relationship_to_subscriber: Optional[str] = None
    effective_date: Optional[date] = None
    termination_date: Optional[date] = None
    copay_amount: Optional[float] = None
    deductible_amount: Optional[float] = None


class PatientInsuranceUpdate(BaseModel):
    member_id: Optional[str] = None
    group_number: Optional[str] = None
    priority: Optional[int] = None
    effective_date: Optional[date] = None
    termination_date: Optional[date] = None
    copay_amount: Optional[float] = None
    deductible_amount: Optional[float] = None
    is_active: Optional[bool] = None


class PatientInsuranceResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    patient_id: uuid.UUID
    payer_id: uuid.UUID
    priority: int
    member_id: str
    group_number: Optional[str]
    plan_name: Optional[str]
    subscriber_first_name: Optional[str]
    subscriber_last_name: Optional[str]
    effective_date: Optional[date]
    termination_date: Optional[date]
    copay_amount: Optional[float]
    deductible_amount: Optional[float]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class EligibilityCheckResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    patient_insurance_id: uuid.UUID
    check_date: datetime
    status: str
    copay_amount: Optional[float]
    deductible_amount: Optional[float]
    deductible_met: Optional[float]
    out_of_pocket_max: Optional[float]
    coinsurance_pct: Optional[float]
    error_message: Optional[str]

    model_config = {"from_attributes": True}
