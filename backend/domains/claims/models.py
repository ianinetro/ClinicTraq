from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, event, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def _generate_claim_number(context) -> str:
    """Generate a claim number in format CT-YYYYMMDD-XXXXXX using sequence."""
    from datetime import date as dt
    today = dt.today().strftime("%Y%m%d")
    # Use the raw connection to get the next value from a sequence
    try:
        result = context.connection.execute(
            "SELECT nextval('claim_number_seq')"
        )
        seq = result.scalar()
        return f"CT-{today}-{seq:06d}"
    except Exception:
        import random
        seq = random.randint(1, 999999)
        return f"CT-{today}-{seq:06d}"


class Claim(Base):
    __tablename__ = "claims"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # PCN = claim ID (str representation)
    claim_number: Mapped[Optional[str]] = mapped_column(String(30), unique=True, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"))
    provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("providers.id"))
    billing_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_providers.id"))
    referring_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("referring_providers.id"))
    payer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("payers.id"))
    patient_insurance_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("patient_insurances.id"))
    # Claim details
    claim_type: Mapped[str] = mapped_column(String(20), default="professional")
    date_of_service: Mapped[Optional[date]] = mapped_column(Date)
    admit_date: Mapped[Optional[date]] = mapped_column(Date)
    discharge_date: Mapped[Optional[date]] = mapped_column(Date)
    admit_code: Mapped[Optional[str]] = mapped_column(String(2))
    discharge_code: Mapped[Optional[str]] = mapped_column(String(2))
    # Financials
    total_charge: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_allowed: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_paid: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_adjustment: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    patient_responsibility: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    balance: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    # Status
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    # draft | validated | submitted | accepted | rejected | paid | denied | appealed | closed
    validation_status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending | valid | invalid | warnings
    # Diagnoses snapshot (denormalized from visit)
    diagnoses_snapshot: Mapped[Optional[List[Dict]]] = mapped_column(JSONB)
    # Authorization
    authorization_number: Mapped[Optional[str]] = mapped_column(String(50))
    # Payer claim reference
    payer_claim_number: Mapped[Optional[str]] = mapped_column(String(100))
    # Submission tracking
    last_submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Flags
    is_secondary: Mapped[bool] = mapped_column(Boolean, default=False)
    primary_claim_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    lines: Mapped[List["ClaimLine"]] = relationship("ClaimLine", back_populates="claim")
    validation_issues: Mapped[List["ClaimValidationIssue"]] = relationship("ClaimValidationIssue", back_populates="claim")
    submissions: Mapped[List["ClaimSubmission"]] = relationship("ClaimSubmission", back_populates="claim")
    status_events: Mapped[List["ClaimStatusEvent"]] = relationship("ClaimStatusEvent", back_populates="claim")

    @property
    def patient_control_number(self) -> str:
        """PCN == claim ID as per spec."""
        return str(self.id)


class ClaimLine(Base):
    __tablename__ = "claim_lines"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    claim_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=False, index=True)
    cpt_code: Mapped[str] = mapped_column(String(10), nullable=False)
    modifiers: Mapped[Optional[List[str]]] = mapped_column(JSONB)
    units: Mapped[int] = mapped_column(Integer, default=1)
    charge_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    allowed_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    paid_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    adjustment_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    revenue_code: Mapped[Optional[str]] = mapped_column(String(4))
    sequence: Mapped[int] = mapped_column(Integer, default=1)
    diagnosis_pointers: Mapped[Optional[List[int]]] = mapped_column(JSONB)
    rendering_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    place_of_service_code: Mapped[Optional[str]] = mapped_column(String(2))

    claim: Mapped["Claim"] = relationship("Claim", back_populates="lines")


class ClaimValidationIssue(Base):
    __tablename__ = "claim_validation_issues"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    claim_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # blocking | warning | info
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    field_path: Mapped[Optional[str]] = mapped_column(String(100))
    line_sequence: Mapped[Optional[int]] = mapped_column(Integer)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)

    claim: Mapped["Claim"] = relationship("Claim", back_populates="validation_issues")


class ClaimSubmission(Base):
    __tablename__ = "claim_submissions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    claim_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=False, index=True)
    submission_method: Mapped[str] = mapped_column(String(30), default="electronic")  # electronic | paper
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    clearinghouse: Mapped[Optional[str]] = mapped_column(String(100))
    batch_id: Mapped[Optional[str]] = mapped_column(String(100))
    interchange_control_number: Mapped[Optional[str]] = mapped_column(String(20))
    acknowledgment_status: Mapped[Optional[str]] = mapped_column(String(30))
    acknowledgment_received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    response_data: Mapped[Optional[Dict]] = mapped_column(JSONB)
    submitted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    claim: Mapped["Claim"] = relationship("Claim", back_populates="submissions")


class ClaimStatusEvent(Base):
    __tablename__ = "claim_status_events"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    claim_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=False, index=True)
    from_status: Mapped[Optional[str]] = mapped_column(String(30))
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    note: Mapped[Optional[str]] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    claim: Mapped["Claim"] = relationship("Claim", back_populates="status_events")
