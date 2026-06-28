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
    practice_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("practices.id"))
    office_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("offices.id"))
    facility_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("facilities.id"))
    provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("providers.id"))
    billing_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_providers.id"))
    rendering_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("providers.id"))
    visit_date: Mapped[date] = mapped_column(Date, nullable=False)
    visit_type: Mapped[Optional[str]] = mapped_column(String(50))
    reason: Mapped[Optional[str]] = mapped_column(String(255))
    chief_complaint: Mapped[Optional[str]] = mapped_column(Text)
    allergies: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="open")
    print_statement_flag: Mapped[bool] = mapped_column(Boolean, default=True)
    vital_signs: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    assigned_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    diagnoses: Mapped[List["VisitDiagnosis"]] = relationship("VisitDiagnosis", back_populates="visit", cascade="all, delete-orphan")
    charge_lines: Mapped[List["ChargeLine"]] = relationship("ChargeLine", back_populates="visit", cascade="all, delete-orphan")
    billing_options: Mapped[Optional["VisitBillingOptions"]] = relationship("VisitBillingOptions", back_populates="visit", uselist=False, cascade="all, delete-orphan")
    visit_notes: Mapped[List["VisitNote"]] = relationship("VisitNote", back_populates="visit", cascade="all, delete-orphan")


class VisitDiagnosis(Base):
    __tablename__ = "visit_diagnoses"

    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, index=True)
    code_type: Mapped[str] = mapped_column(String(10), default="ICD-10")
    diagnosis_code: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    pointer_label: Mapped[str] = mapped_column(String(1), nullable=False)  # A-L
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)

    visit: Mapped["Visit"] = relationship("Visit", back_populates="diagnoses")


class ChargeLine(Base):
    __tablename__ = "charge_lines"

    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    dos_from: Mapped[date] = mapped_column(Date, nullable=False)
    dos_to: Mapped[date] = mapped_column(Date, nullable=False)
    pos: Mapped[str] = mapped_column(String(2), nullable=False)
    cpt_code: Mapped[str] = mapped_column(String(10), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255))
    modifier_a: Mapped[Optional[str]] = mapped_column(String(2))
    modifier_b: Mapped[Optional[str]] = mapped_column(String(2))
    modifier_c: Mapped[Optional[str]] = mapped_column(String(2))
    modifier_d: Mapped[Optional[str]] = mapped_column(String(2))
    icd_pointers: Mapped[Optional[str]] = mapped_column(String(20))
    charge: Mapped[Any] = mapped_column(Numeric(10, 2), nullable=False)
    units: Mapped[int] = mapped_column(Integer, default=1)
    insurance_payment: Mapped[Any] = mapped_column(Numeric(10, 2), default=0)
    patient_payment: Mapped[Any] = mapped_column(Numeric(10, 2), default=0)
    adjustment: Mapped[Any] = mapped_column(Numeric(10, 2), default=0)
    line_note: Mapped[Optional[str]] = mapped_column(Text)
    anesthesia_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    ndc_qualifier: Mapped[Optional[str]] = mapped_column(String(10))
    ndc_code: Mapped[Optional[str]] = mapped_column(String(20))
    ndc_unit_price: Mapped[Optional[Any]] = mapped_column(Numeric(10, 4))
    ndc_quantity: Mapped[Optional[Any]] = mapped_column(Numeric(10, 3))
    ndc_qualifier_unit: Mapped[Optional[str]] = mapped_column(String(10))

    visit: Mapped["Visit"] = relationship("Visit", back_populates="charge_lines")

    @property
    def balance(self) -> Any:
        charge = self.charge or 0
        ins = self.insurance_payment or 0
        pat = self.patient_payment or 0
        adj = self.adjustment or 0
        return charge - ins - pat - adj


class VisitBillingOptions(Base):
    __tablename__ = "visit_billing_options"

    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, unique=True)
    referring_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("referring_providers.id"))
    supervising_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("providers.id"))
    ordering_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("providers.id"))
    prior_auth_number: Mapped[Optional[str]] = mapped_column(String(50))
    employment_related: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_accident: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_accident_state: Mapped[Optional[str]] = mapped_column(String(2))
    other_accident: Mapped[bool] = mapped_column(Boolean, default=False)
    onset_date: Mapped[Optional[date]] = mapped_column(Date)
    hospitalization_from: Mapped[Optional[date]] = mapped_column(Date)
    hospitalization_to: Mapped[Optional[date]] = mapped_column(Date)
    initial_treatment_date: Mapped[Optional[date]] = mapped_column(Date)
    last_seen_date: Mapped[Optional[date]] = mapped_column(Date)
    accident_date: Mapped[Optional[date]] = mapped_column(Date)
    medicaid_resubmission_code: Mapped[Optional[str]] = mapped_column(String(20))
    original_ref_number: Mapped[Optional[str]] = mapped_column(String(50))
    clia_number: Mapped[Optional[str]] = mapped_column(String(20))
    mammography_cert: Mapped[Optional[str]] = mapped_column(String(20))
    delay_reason_code: Mapped[Optional[str]] = mapped_column(String(10))
    ambulance_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    attachment_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    hospice_employee: Mapped[bool] = mapped_column(Boolean, default=False)
    referral_number: Mapped[Optional[str]] = mapped_column(String(50))
    contract_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)

    visit: Mapped["Visit"] = relationship("Visit", back_populates="billing_options")


class VisitNote(Base):
    __tablename__ = "visit_notes"

    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)

    visit: Mapped["Visit"] = relationship("Visit", back_populates="visit_notes")


class VitalSigns(Base):
    __tablename__ = "vital_signs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    height_in: Mapped[Optional[Any]] = mapped_column(Numeric(5, 2))
    weight_lbs: Mapped[Optional[Any]] = mapped_column(Numeric(6, 2))
    bmi: Mapped[Optional[Any]] = mapped_column(Numeric(5, 2))
    systolic_bp: Mapped[Optional[int]] = mapped_column(Integer)
    diastolic_bp: Mapped[Optional[int]] = mapped_column(Integer)
    heart_rate: Mapped[Optional[int]] = mapped_column(Integer)
    respiratory_rate: Mapped[Optional[int]] = mapped_column(Integer)
    temperature_f: Mapped[Optional[Any]] = mapped_column(Numeric(5, 2))
    o2_sat: Mapped[Optional[int]] = mapped_column(Integer)
    pain_scale: Mapped[Optional[int]] = mapped_column(Integer)
    recorded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    recorded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Order(Base):
    __tablename__ = "visit_orders"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    order_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="routine")
    status: Mapped[str] = mapped_column(String(50), default="pending")
    ordered_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    ordered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    external_ref: Mapped[Optional[str]] = mapped_column(String(255))
