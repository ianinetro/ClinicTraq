from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class PatientDeductibleTracker(Base):
    __tablename__ = "patient_deductible_trackers"
    __table_args__ = (
        UniqueConstraint(
            "patient_insurance_id", "calendar_year", name="uq_deductible_insurance_year"
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_insurance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patient_insurances.id"),
        nullable=False,
        index=True,
    )
    calendar_year: Mapped[int] = mapped_column(Integer, nullable=False)
    deductible_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    amount_met: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


async def update_deductible(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    patient_insurance_id: uuid.UUID,
    calendar_year: int,
    amount_applied: float,
    deductible_amount: Optional[float] = None,
) -> PatientDeductibleTracker:
    """Add amount_applied toward the deductible for the given year. Creates tracker if absent."""
    result = await db.execute(
        select(PatientDeductibleTracker).where(
            PatientDeductibleTracker.patient_insurance_id == patient_insurance_id,
            PatientDeductibleTracker.calendar_year == calendar_year,
            PatientDeductibleTracker.tenant_id == tenant_id,
        )
    )
    tracker = result.scalar_one_or_none()

    if tracker is None:
        tracker = PatientDeductibleTracker(
            tenant_id=tenant_id,
            patient_insurance_id=patient_insurance_id,
            calendar_year=calendar_year,
            deductible_amount=deductible_amount or 0,
            amount_met=0,
        )
        db.add(tracker)

    if deductible_amount is not None:
        tracker.deductible_amount = deductible_amount

    tracker.amount_met = float(tracker.amount_met) + amount_applied
    tracker.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return tracker


async def get_remaining_deductible(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    patient_insurance_id: uuid.UUID,
    calendar_year: int,
) -> float:
    """Return the remaining deductible amount for the given year. Returns 0 if fully met."""
    result = await db.execute(
        select(PatientDeductibleTracker).where(
            PatientDeductibleTracker.patient_insurance_id == patient_insurance_id,
            PatientDeductibleTracker.calendar_year == calendar_year,
            PatientDeductibleTracker.tenant_id == tenant_id,
        )
    )
    tracker = result.scalar_one_or_none()
    if tracker is None:
        return 0.0
    remaining = float(tracker.deductible_amount) - float(tracker.amount_met)
    return max(0.0, remaining)
