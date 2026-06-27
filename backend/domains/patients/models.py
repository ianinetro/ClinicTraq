from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Patient(Base):
    __tablename__ = "patients"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    practice_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("practices.id"), nullable=True)
    account_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    dob: Mapped[Optional[date]] = mapped_column(Date)
    sex: Mapped[Optional[str]] = mapped_column(String(10))
    ssn_encrypted: Mapped[Optional[str]] = mapped_column(String(255))
    account_type: Mapped[str] = mapped_column(String(50), default="patient")
    status: Mapped[str] = mapped_column(String(50), default="active")
    primary_care_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("providers.id"))
    referring_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("referring_providers.id"))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip: Mapped[Optional[str]] = mapped_column(String(10))
    phone_home: Mapped[Optional[str]] = mapped_column(String(20))
    phone_work: Mapped[Optional[str]] = mapped_column(String(20))
    phone_cell: Mapped[Optional[str]] = mapped_column(String(20))
    preferred_phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    communication_pref: Mapped[Optional[str]] = mapped_column(String(50))
    marital_status: Mapped[Optional[str]] = mapped_column(String(50))
    preferred_language: Mapped[Optional[str]] = mapped_column(String(50))
    race: Mapped[Optional[str]] = mapped_column(String(50))
    ethnicity: Mapped[Optional[str]] = mapped_column(String(50))
    gender_identity: Mapped[Optional[str]] = mapped_column(String(50))
    sexual_orientation: Mapped[Optional[str]] = mapped_column(String(50))
    employment_info: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    emergency_contact: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    next_of_kin: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    user_defined_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    confidential_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    exempt_reporting_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    no_statement_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    search_vector: Mapped[Optional[Any]] = mapped_column(TSVECTOR, nullable=True)

    insurances: Mapped[List["PatientInsurance"]] = relationship("PatientInsurance", back_populates="patient")
    guarantors: Mapped[List["Guarantor"]] = relationship("Guarantor", back_populates="patient")
    eligibility_checks: Mapped[List["EligibilityCheck"]] = relationship("EligibilityCheck", back_populates="patient")
    body_map_annotations: Mapped[List["BodyMapAnnotation"]] = relationship("BodyMapAnnotation", back_populates="patient")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class PatientInsurance(Base):
    __tablename__ = "patient_insurances"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False)  # primary/secondary/tertiary
    payer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("payers.id"))
    subscriber_id: Mapped[Optional[str]] = mapped_column(String(100))
    group_number: Mapped[Optional[str]] = mapped_column(String(100))
    plan_name: Mapped[Optional[str]] = mapped_column(String(255))
    copay: Mapped[Optional[Any]] = mapped_column(Numeric(10, 2))
    deductible: Mapped[Optional[Any]] = mapped_column(Numeric(10, 2))
    relationship_to_insured: Mapped[Optional[str]] = mapped_column(String(50))
    release_of_info: Mapped[bool] = mapped_column(Boolean, default=False)
    signature_on_file: Mapped[bool] = mapped_column(Boolean, default=False)
    signature_date: Mapped[Optional[date]] = mapped_column(Date)
    auth_number: Mapped[Optional[str]] = mapped_column(String(100))
    auth_visits: Mapped[Optional[int]] = mapped_column(Integer)
    auth_effective_from: Mapped[Optional[date]] = mapped_column(Date)
    auth_effective_to: Mapped[Optional[date]] = mapped_column(Date)
    auth_visits_used: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="insurances")
    deductible_trackers: Mapped[List["PatientDeductibleTracker"]] = relationship("PatientDeductibleTracker", back_populates="patient_insurance")


class Guarantor(Base):
    __tablename__ = "guarantors"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    relationship_to_patient: Mapped[Optional[str]] = mapped_column(String(50))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip: Mapped[Optional[str]] = mapped_column(String(10))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    is_self: Mapped[bool] = mapped_column(Boolean, default=False)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="guarantors")


class EligibilityCheck(Base):
    __tablename__ = "eligibility_checks"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    patient_insurance_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("patient_insurances.id"))
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    checked_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    response_raw: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    coverage_active: Mapped[Optional[bool]] = mapped_column(Boolean)
    copay: Mapped[Optional[Any]] = mapped_column(Numeric(10, 2))
    deductible: Mapped[Optional[Any]] = mapped_column(Numeric(10, 2))
    deductible_met: Mapped[Optional[Any]] = mapped_column(Numeric(10, 2))
    out_of_pocket: Mapped[Optional[Any]] = mapped_column(Numeric(10, 2))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")

    patient: Mapped["Patient"] = relationship("Patient", back_populates="eligibility_checks")


class PatientDeductibleTracker(Base):
    __tablename__ = "patient_deductible_trackers"

    patient_insurance_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patient_insurances.id"), nullable=False, index=True)
    calendar_year: Mapped[int] = mapped_column(Integer, nullable=False)
    deductible_amount: Mapped[Any] = mapped_column(Numeric(10, 2), nullable=False)
    amount_met: Mapped[Any] = mapped_column(Numeric(10, 2), default=0)

    patient_insurance: Mapped["PatientInsurance"] = relationship("PatientInsurance", back_populates="deductible_trackers")


class BodyMapAnnotation(Base):
    __tablename__ = "body_map_annotations"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    region_code: Mapped[str] = mapped_column(String(50), nullable=False)
    annotation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="none")
    linked_diagnosis_code: Mapped[Optional[str]] = mapped_column(String(20))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    patient: Mapped["Patient"] = relationship("Patient", back_populates="body_map_annotations")
