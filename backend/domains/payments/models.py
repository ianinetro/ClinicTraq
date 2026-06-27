from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Payment(Base):
    __tablename__ = "payments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    payer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("payers.id"), index=True)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_type: Mapped[str] = mapped_column(String(30), nullable=False)  # insurance | patient | era
    payment_method: Mapped[Optional[str]] = mapped_column(String(30))  # check | eft | credit | cash
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    unapplied_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    check_number: Mapped[Optional[str]] = mapped_column(String(50))
    reference_number: Mapped[Optional[str]] = mapped_column(String(100))
    deposit_date: Mapped[Optional[date]] = mapped_column(Date)
    era_file_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("era_files.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_reversed: Mapped[bool] = mapped_column(Boolean, default=False)
    reversed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    reversal_of_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    posted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    applications: Mapped[List["PaymentApplication"]] = relationship("PaymentApplication", back_populates="payment")
    adjustments: Mapped[List["Adjustment"]] = relationship("Adjustment", back_populates="payment")


class PaymentApplication(Base):
    __tablename__ = "payment_applications"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    payment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False, index=True)
    claim_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("claims.id"), index=True)
    claim_line_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("claim_lines.id"))
    amount_applied: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    adjustment_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    adjustment_code: Mapped[Optional[str]] = mapped_column(String(10))
    adjustment_reason: Mapped[Optional[str]] = mapped_column(String(255))
    is_reversed: Mapped[bool] = mapped_column(Boolean, default=False)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payment: Mapped["Payment"] = relationship("Payment", back_populates="applications")


class Adjustment(Base):
    __tablename__ = "adjustments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("payments.id"))
    claim_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("claims.id"), index=True)
    claim_line_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("claim_lines.id"))
    adjustment_type: Mapped[str] = mapped_column(String(50), nullable=False)  # contractual | write_off | patient_discount
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    reason_code: Mapped[Optional[str]] = mapped_column(String(10))
    reason_description: Mapped[Optional[str]] = mapped_column(String(255))
    adjusted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    payment: Mapped[Optional["Payment"]] = relationship("Payment", back_populates="adjustments")


class ERAFile(Base):
    __tablename__ = "era_files"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    payer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("payers.id"))
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(Integer)
    transaction_set_id: Mapped[Optional[str]] = mapped_column(String(20))
    check_number: Mapped[Optional[str]] = mapped_column(String(50))
    check_date: Mapped[Optional[date]] = mapped_column(Date)
    total_payment: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | processing | imported | error
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    raw_content: Mapped[Optional[str]] = mapped_column(Text)  # stored EDI text
    imported_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    era_payments: Mapped[List["ERAPayment"]] = relationship("ERAPayment", back_populates="era_file")


class ERAPayment(Base):
    __tablename__ = "era_payments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    era_file_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("era_files.id"), nullable=False, index=True)
    claim_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("claims.id"), index=True)
    patient_control_number: Mapped[Optional[str]] = mapped_column(String(50))
    payer_claim_control_number: Mapped[Optional[str]] = mapped_column(String(50))
    billed_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    paid_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    patient_name: Mapped[Optional[str]] = mapped_column(String(200))
    dos: Mapped[Optional[date]] = mapped_column(Date)
    match_confidence: Mapped[float] = mapped_column(Numeric(4, 3), default=0.0)
    match_status: Mapped[str] = mapped_column(String(20), default="unmatched")  # unmatched | matched | auto_posted
    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("payments.id"))

    era_file: Mapped["ERAFile"] = relationship("ERAFile", back_populates="era_payments")
    service_lines: Mapped[List["ERAServiceLine"]] = relationship("ERAServiceLine", back_populates="era_payment")


class ERAServiceLine(Base):
    __tablename__ = "era_service_lines"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    era_payment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("era_payments.id"), nullable=False, index=True)
    cpt_code: Mapped[Optional[str]] = mapped_column(String(10))
    modifiers: Mapped[Optional[List[str]]] = mapped_column(JSONB)
    dos_from: Mapped[Optional[date]] = mapped_column(Date)
    dos_to: Mapped[Optional[date]] = mapped_column(Date)
    billed_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    paid_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    adjustment_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    adjustment_reason_code: Mapped[Optional[str]] = mapped_column(String(10))
    adjustment_reason_description: Mapped[Optional[str]] = mapped_column(String(255))
    units: Mapped[Optional[int]] = mapped_column(Integer)

    era_payment: Mapped["ERAPayment"] = relationship("ERAPayment", back_populates="service_lines")
