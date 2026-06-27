from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class PracticeCreate(BaseModel):
    name: str
    npi: Optional[str] = None
    tax_id: Optional[str] = None
    taxonomy_code: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None


class PracticeUpdate(BaseModel):
    name: Optional[str] = None
    npi: Optional[str] = None
    tax_id: Optional[str] = None
    taxonomy_code: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    is_active: Optional[bool] = None


class PracticeResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    npi: Optional[str]
    tax_id: Optional[str]
    taxonomy_code: Optional[str]
    address_line1: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip_code: Optional[str]
    phone: Optional[str]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class OfficeCreate(BaseModel):
    practice_id: uuid.UUID
    name: str
    npi: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    place_of_service_code: Optional[str] = None


class OfficeUpdate(BaseModel):
    name: Optional[str] = None
    npi: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    place_of_service_code: Optional[str] = None
    is_active: Optional[bool] = None


class OfficeResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    practice_id: uuid.UUID
    name: str
    npi: Optional[str]
    city: Optional[str]
    state: Optional[str]
    place_of_service_code: Optional[str]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ProviderCreate(BaseModel):
    first_name: str
    last_name: str
    npi: str
    taxonomy_code: Optional[str] = None
    specialty: Optional[str] = None
    credential: Optional[str] = None
    upin: Optional[str] = None
    license_number: Optional[str] = None
    license_state: Optional[str] = None
    dea_numbers: Optional[Dict[str, Any]] = None
    office_id: Optional[uuid.UUID] = None


class ProviderUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    npi: Optional[str] = None
    taxonomy_code: Optional[str] = None
    specialty: Optional[str] = None
    credential: Optional[str] = None
    dea_numbers: Optional[Dict[str, Any]] = None
    office_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


class ProviderResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    first_name: str
    last_name: str
    npi: str
    taxonomy_code: Optional[str]
    specialty: Optional[str]
    credential: Optional[str]
    dea_numbers: Optional[Dict[str, Any]]
    office_id: Optional[uuid.UUID]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class PayerCreate(BaseModel):
    name: str
    payer_id: str
    payer_type: str = "commercial"
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    billing_rules: Optional[Dict[str, Any]] = None
    tfl_days: int = 365


class PayerUpdate(BaseModel):
    name: Optional[str] = None
    payer_id: Optional[str] = None
    payer_type: Optional[str] = None
    billing_rules: Optional[Dict[str, Any]] = None
    tfl_days: Optional[int] = None
    is_active: Optional[bool] = None


class PayerResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    payer_id: str
    payer_type: str
    billing_rules: Optional[Dict[str, Any]]
    tfl_days: int
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class CPTCodeCreate(BaseModel):
    code: str
    description: str
    category: Optional[str] = None
    default_units: int = 1
    default_fee: Optional[float] = None
    effective_date: Optional[date] = None
    end_date: Optional[date] = None


class CPTCodeUpdate(BaseModel):
    description: Optional[str] = None
    default_fee: Optional[float] = None
    is_active: Optional[bool] = None
    end_date: Optional[date] = None


class CPTCodeResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    code: str
    description: str
    default_units: int
    default_fee: Optional[float]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class DiagnosisCodeCreate(BaseModel):
    code: str
    description: str
    code_type: str = "ICD-10"
    effective_date: Optional[date] = None
    end_date: Optional[date] = None


class DiagnosisCodeUpdate(BaseModel):
    description: Optional[str] = None
    is_active: Optional[bool] = None
    end_date: Optional[date] = None


class DiagnosisCodeResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    code: str
    description: str
    code_type: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ProviderPayerPinCreate(BaseModel):
    provider_id: uuid.UUID
    payer_id: uuid.UUID
    pin: str
    group_number: Optional[str] = None


class ProviderPayerPinResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    provider_id: uuid.UUID
    payer_id: uuid.UUID
    pin: str
    group_number: Optional[str]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class NPIValidationResponse(BaseModel):
    npi: str
    valid: bool
    message: str
