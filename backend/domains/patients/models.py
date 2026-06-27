from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, Optional

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Patient(Base):
    __tablename__ = "patients"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # Name
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    suffix: Mapped[Optional[str]] = mapped_column(String(20))
    # Demographics
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    marital_status: Mapped[Optional[str]] = mapped_column(String(20))
    # Contact
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip_code: Mapped[Optional[str]] = mapped_column(String(10))
    phone_home: Mapped[Optional[str]] = mapped_column(String(20))
    phone_cell: Mapped[Optional[str]] = mapped_column(String(20))
    phone_work: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    # PHI
    ssn_encrypted: Mapped[Optional[str]] = mapped_column(Text)  # Fernet encrypted
    # MRN
    mrn: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    # Clinical
    primary_language: Mapped[Optional[str]] = mapped_column(String(50))
    race: Mapped[Optional[str]] = mapped_column(String(50))
    ethnicity: Mapped[Optional[str]] = mapped_column(String(50))
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Full text search vector — updated via DB trigger in production
    search_vector: Mapped[Optional[Any]] = mapped_column(TSVECTOR)

    insurances: Mapped[list["PatientInsurance"]] = relationship("PatientInsurance", back_populates="patient")
    guarantors: Mapped[list["Guarantor"]] = relationship("Guarantor", back_populates="patient")
    eligibility_checks: Mapped[list["EligibilityCheck"]] = relationship("EligibilityCheck", back_populates="patient")


class PatientInsurance(Base):
    __tablename__ = "patient_insurances"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    payer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payers.id"), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=1)  # 1=primary, 2=secondary, 3=tertiary
    member_id: Mapped[str] = mapped_column(String(100), nullable=False)
    group_number: Mapped[Optional[str]] = mapped_column(String(50))
    plan_name: Mapped[Optional[str]] = mapped_column(String(100))
    # Subscriber info (if patient is not subscriber)
    subscriber_first_name: Mapped[Optional[str]] = mapped_column(String(100))
    subscriber_last_name: Mapped[Optional[str]] = mapped_column(String(100))
    subscriber_dob: Mapped[Optional[date]] = mapped_column(Date)
    subscriber_gender: Mapped[Optional[str]] = mapped_column(String(20))
    relationship_to_subscriber: Mapped[Optional[str]] = mapped_column(String(50))
    # Effective dates
    effective_date: Mapped[Optional[date]] = mapped_column(Date)
    termination_date: Mapped[Optional[date]] = mapped_column(Date)
    # Copay / deductible info
    copay_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    deductible_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="insurances")


class Guarantor(Base):
    __tablename__ = "guarantors"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    relationship: Mapped[Optional[str]] = mapped_column(String(50))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip_code: Mapped[Optional[str]] = mapped_column(String(10))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    ssn_encrypted: Mapped[Optional[str]] = mapped_column(Text)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="guarantors")


class EligibilityCheck(Base):
    __tablename__ = "eligibility_checks"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    patient_insurance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patient_insurances.id"), nullable=False
    )
    check_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, active, inactive, error
    response_data: Mapped[Optional[Dict]] = mapped_column(JSONB)
    copay_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    deductible_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    deductible_met: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    out_of_pocket_max: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    out_of_pocket_met: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    coinsurance_pct: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="eligibility_checks")


class BodyMapAnnotation(Base):
    __tablename__ = "body_map_annotations"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    body_region: Mapped[str] = mapped_column(String(100), nullable=False)
    annotation_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pain, injury, finding
    severity: Mapped[Optional[str]] = mapped_column(String(20))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    coordinates: Mapped[Optional[Dict]] = mapped_column(JSONB)  # {x, y, view: 'front'|'back'}
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
