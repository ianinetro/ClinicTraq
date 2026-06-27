from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class PayerTFLSetting(Base):
    """Per-payer Timely Filing Limit override. When set, takes precedence over Payer.tfl_days."""

    __tablename__ = "payer_tfl_settings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "payer_id", name="uq_payer_tfl_tenant_payer"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    payer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payers.id"), nullable=False
    )
    tfl_days: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(nullable=True)


async def get_tfl_days(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payer_id: uuid.UUID,
    default_tfl_days: int = 365,
) -> int:
    """Return the effective TFL days for a payer.

    Lookup order:
    1. PayerTFLSetting override (tenant-specific)
    2. Payer.tfl_days field
    3. Provided default (365 days)
    """
    # Check for explicit override first
    result = await db.execute(
        select(PayerTFLSetting).where(
            PayerTFLSetting.tenant_id == tenant_id,
            PayerTFLSetting.payer_id == payer_id,
        )
    )
    setting = result.scalar_one_or_none()
    if setting is not None:
        return setting.tfl_days

    # Fall back to the payer's own tfl_days
    from domains.master_data.models import Payer  # local import to avoid circular

    payer_result = await db.execute(
        select(Payer).where(Payer.id == payer_id, Payer.tenant_id == tenant_id)
    )
    payer = payer_result.scalar_one_or_none()
    if payer is not None:
        return payer.tfl_days

    return default_tfl_days


def is_within_tfl(date_of_service: date, tfl_days: int) -> bool:
    """Return True if DOS is still within the timely filing window."""
    delta = (date.today() - date_of_service).days
    return delta <= tfl_days
