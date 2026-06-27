from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Visit(Base):
    __tablename__ = "visits"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("providers.id"))
    office_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("offices.id"))
    facility_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("facilities.id"))
    date_of_service: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # Hospital fields
    admit_date: Mapped[Optional[date]] = mapped_column(Date)
    discharge_date: Mapped[Optional[date]] = mapped_column(Date)
    admit_code: Mapped[Optional[str]] = mapped_column(String(2))   # UB-04 admit type
    discharge_code: Mapped[Optional[str]] = mapped_column(String(2))  # UB-04 patient status
    claim_type: Mapped[str] = mapped_column(String(20), default="professional")  # professional | institutional
    status: Mapped[str] = mapped_column(String(30), default="open")  # open, billed, cancelled
    visit_type: Mapped[Optional[str]] = mapped_column(String(50))
    place_of_service_code: Mapped[Optional[str]] = mapped_column(String(2))
    # Clinical
    chief_complaint: Mapped[Optional[str]] = mapped_column(Text)
    vital_signs: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    # Billing
    superbill_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    superbill_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    diagnoses: Mapped[List["VisitDiagnosis"]] = relationship("VisitDiagnosis", back_populates="visit")
    charge_lines: Mapped[List["ChargeLine"]] = relationship("ChargeLine", back_populates="visit")
    billing_options: Mapped[Optional["VisitBillingOptions"]] = relationship("VisitBillingOptions", back_populates="visit", uselist=False)
    notes: Mapped[List["VisitNote"]] = relationship("VisitNote", back_populates="visit")


class VisitDiagnosis(Base):
    __tablename__ = "visit_diagnoses"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, index=True)
    diagnosis_code_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("diagnosis_codes.id"))
    icd_code: Mapped[str] = mapped_column(String(10), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 1 = primary
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    poa: Mapped[Optional[str]] = mapped_column(String(1))  # present on admission: Y/N/W/U/1

    visit: Mapped["Visit"] = relationship("Visit", back_populates="diagnoses")


class ChargeLine(Base):
    __tablename__ = "charge_lines"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, index=True)
    cpt_code_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cpt_codes.id"))
    cpt_code: Mapped[str] = mapped_column(String(10), nullable=False)
    modifiers: Mapped[Optional[List[str]]] = mapped_column(JSONB)  # ["25", "RT"]
    units: Mapped[int] = mapped_column(Integer, default=1)
    charge_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    allowed_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    revenue_code: Mapped[Optional[str]] = mapped_column(String(4))  # UB-04
    sequence: Mapped[int] = mapped_column(Integer, default=1)
    # Diagnosis pointers (1-based index into visit diagnoses)
    diagnosis_pointers: Mapped[Optional[List[int]]] = mapped_column(JSONB)

    visit: Mapped["Visit"] = relationship("Visit", back_populates="charge_lines")


class VisitBillingOptions(Base):
    __tablename__ = "visit_billing_options"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, unique=True)
    primary_insurance_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("patient_insurances.id"))
    secondary_insurance_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("patient_insurances.id"))
    billing_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_providers.id"))
    referring_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("referring_providers.id"))
    authorization_number: Mapped[Optional[str]] = mapped_column(String(50))
    referral_number: Mapped[Optional[str]] = mapped_column(String(50))
    hold_claim: Mapped[bool] = mapped_column(Boolean, default=False)
    accident_related: Mapped[bool] = mapped_column(Boolean, default=False)
    accident_date: Mapped[Optional[date]] = mapped_column(Date)
    accident_state: Mapped[Optional[str]] = mapped_column(String(2))

    visit: Mapped["Visit"] = relationship("Visit", back_populates="billing_options")


class VisitNote(Base):
    __tablename__ = "visit_notes"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, index=True)
    note_type: Mapped[str] = mapped_column(String(50), default="clinical")  # clinical, billing, admin
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    visit: Mapped["Visit"] = relationship("Visit", back_populates="notes")
