from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class PaymentCreate(BaseModel):
    patient_id: Optional[uuid.UUID] = None
    payer_id: Optional[uuid.UUID] = None
    payment_date: date
    payment_type: str  # insurance | patient | era
    payment_method: Optional[str] = None
    amount: float
    check_number: Optional[str] = None
    reference_number: Optional[str] = None
    deposit_date: Optional[date] = None
    notes: Optional[str] = None


class PaymentUpdate(BaseModel):
    payment_date: Optional[date] = None
    payment_method: Optional[str] = None
    amount: Optional[float] = None
    check_number: Optional[str] = None
    reference_number: Optional[str] = None
    deposit_date: Optional[date] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    patient_id: Optional[uuid.UUID]
    payer_id: Optional[uuid.UUID]
    payment_date: date
    payment_type: str
    payment_method: Optional[str]
    amount: float
    unapplied_amount: float
    check_number: Optional[str]
    reference_number: Optional[str]
    is_reversed: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class PaymentApplicationCreate(BaseModel):
    payment_id: uuid.UUID
    claim_id: Optional[uuid.UUID] = None
    claim_line_id: Optional[uuid.UUID] = None
    amount_applied: float
    adjustment_amount: float = 0
    adjustment_code: Optional[str] = None
    adjustment_reason: Optional[str] = None


class PaymentApplicationResponse(BaseModel):
    id: uuid.UUID
    payment_id: uuid.UUID
    claim_id: Optional[uuid.UUID]
    claim_line_id: Optional[uuid.UUID]
    amount_applied: float
    adjustment_amount: float
    adjustment_code: Optional[str]
    is_reversed: bool
    applied_at: datetime
    model_config = {"from_attributes": True}


class ReversalRequest(BaseModel):
    reason: Optional[str] = None


class ERAFileCreate(BaseModel):
    payer_id: Optional[uuid.UUID] = None
    file_name: str
    raw_content: str


class ERAFileResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    payer_id: Optional[uuid.UUID]
    file_name: str
    check_number: Optional[str]
    check_date: Optional[date]
    total_payment: Optional[float]
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ERAPaymentResponse(BaseModel):
    id: uuid.UUID
    era_file_id: uuid.UUID
    claim_id: Optional[uuid.UUID]
    patient_control_number: Optional[str]
    billed_amount: Optional[float]
    paid_amount: Optional[float]
    patient_name: Optional[str]
    dos: Optional[date]
    match_confidence: float
    match_status: str
    model_config = {"from_attributes": True}


class AutoPostRequest(BaseModel):
    era_file_id: uuid.UUID
    min_confidence: float = 0.8


class ManualMatchRequest(BaseModel):
    era_payment_id: uuid.UUID
    claim_id: uuid.UUID
