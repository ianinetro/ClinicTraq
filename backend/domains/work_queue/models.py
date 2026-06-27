from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

# Work item type constants
WORK_ITEM_CLAIM_DENIAL = "claim_denial"
WORK_ITEM_ELIGIBILITY_ISSUE = "eligibility_issue"
WORK_ITEM_MISSING_INFO = "missing_info"
WORK_ITEM_SECONDARY_BILLING = "secondary_billing"
WORK_ITEM_PATIENT_BALANCE = "patient_balance"
WORK_ITEM_STALE_CLAIM = "stale_claim"
WORK_ITEM_UNAPPLIED_PAYMENT = "unapplied_payment"
WORK_ITEM_ERA_MATCH = "era_match_needed"
WORK_ITEM_SUPERBILL_MISMATCH = "superbill_mismatch"
WORK_ITEM_AUTH_EXPIRING = "auth_expiring"
WORK_ITEM_TFL_WARNING = "tfl_warning"

ALL_WORK_ITEM_TYPES = [
    WORK_ITEM_CLAIM_DENIAL,
    WORK_ITEM_ELIGIBILITY_ISSUE,
    WORK_ITEM_MISSING_INFO,
    WORK_ITEM_SECONDARY_BILLING,
    WORK_ITEM_PATIENT_BALANCE,
    WORK_ITEM_STALE_CLAIM,
    WORK_ITEM_UNAPPLIED_PAYMENT,
    WORK_ITEM_ERA_MATCH,
    WORK_ITEM_SUPERBILL_MISMATCH,
    WORK_ITEM_AUTH_EXPIRING,
    WORK_ITEM_TFL_WARNING,
]

WORK_ITEM_PRIORITY_LOW = "low"
WORK_ITEM_PRIORITY_NORMAL = "normal"
WORK_ITEM_PRIORITY_HIGH = "high"
WORK_ITEM_PRIORITY_URGENT = "urgent"

WORK_ITEM_STATUS_OPEN = "open"
WORK_ITEM_STATUS_IN_PROGRESS = "in_progress"
WORK_ITEM_STATUS_RESOLVED = "resolved"
WORK_ITEM_STATUS_DISMISSED = "dismissed"


class WorkItem(Base):
    __tablename__ = "work_items"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    item_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default=WORK_ITEM_STATUS_OPEN, index=True)
    priority: Mapped[str] = mapped_column(String(20), default=WORK_ITEM_PRIORITY_NORMAL, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    # Resource references
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), index=True)
    claim_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), index=True)
    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    # Assignment
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    # Tracking
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_action_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    # Metadata
    extra_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    escalated: Mapped[bool] = mapped_column(Boolean, default=False)
    escalated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    notes: Mapped[list["WorkItemNote"]] = relationship("WorkItemNote", back_populates="work_item")


class WorkItemNote(Base):
    __tablename__ = "work_item_notes"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    work_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_items.id"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    work_item: Mapped["WorkItem"] = relationship("WorkItem", back_populates="notes")
