from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

# PatientDeductibleTracker is defined in models.py (to avoid duplicate table)
from domains.patients.models import PatientDeductibleTracker  # noqa: F401 — re-exported


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
        )
    )
    tracker = result.scalar_one_or_none()

    if tracker is None:
        tracker = PatientDeductibleTracker(
            patient_insurance_id=patient_insurance_id,
            calendar_year=calendar_year,
            deductible_amount=deductible_amount or 0,
            amount_met=0,
        )
        db.add(tracker)

    if deductible_amount is not None:
        tracker.deductible_amount = deductible_amount

    tracker.amount_met = float(tracker.amount_met) + amount_applied
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
        )
    )
    tracker = result.scalar_one_or_none()
    if tracker is None:
        return 0.0
    remaining = float(tracker.deductible_amount) - float(tracker.amount_met)
    return max(0.0, remaining)
