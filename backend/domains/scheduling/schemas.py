from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


VALID_APPOINTMENT_TYPES = {"office_visit", "follow_up", "new_patient", "telehealth", "procedure", "other"}
VALID_STATUSES = {"scheduled", "confirmed", "checked_in", "roomed", "in_exam", "checked_out", "no_show", "cancelled"}


class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    appointment_type: str = "office_visit"
    provider_id: Optional[uuid.UUID] = None
    office_id: Optional[uuid.UUID] = None
    chief_complaint: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("appointment_type")
    @classmethod
    def validate_appointment_type(cls, v: str) -> str:
        if v not in VALID_APPOINTMENT_TYPES:
            raise ValueError(f"appointment_type must be one of: {', '.join(sorted(VALID_APPOINTMENT_TYPES))}")
        return v


class AppointmentUpdate(BaseModel):
    patient_id: Optional[uuid.UUID] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    appointment_type: Optional[str] = None
    status: Optional[str] = None
    provider_id: Optional[uuid.UUID] = None
    office_id: Optional[uuid.UUID] = None
    chief_complaint: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("appointment_type")
    @classmethod
    def validate_appointment_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_APPOINTMENT_TYPES:
            raise ValueError(f"appointment_type must be one of: {', '.join(sorted(VALID_APPOINTMENT_TYPES))}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v


class AppointmentResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    patient_id: uuid.UUID
    provider_id: Optional[uuid.UUID]
    office_id: Optional[uuid.UUID]
    start_time: datetime
    end_time: datetime
    appointment_type: str
    status: str
    chief_complaint: Optional[str]
    notes: Optional[str]
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}
