from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from domains.claims.models import Claim
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import User
from domains.patients.models import Patient

router = APIRouter(tags=["ar"])


def _age_bucket(age_days: int) -> str:
    if age_days <= 30:
        return "Current (0–30)"
    if age_days <= 60:
        return "31–60 days"
    if age_days <= 90:
        return "61–90 days"
    if age_days <= 120:
        return "91–120 days"
    return "120+ days"


@router.get("/ar/summary")
async def ar_summary(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
) -> Dict[str, Any]:
    today = date.today()

    open_statuses = ("submitted", "pending", "partial", "draft")
    stmt = select(Claim).where(
        Claim.tenant_id == ctx.tenant_id,
        Claim.status.in_(open_statuses),
        Claim.balance > 0,
    )
    result = await db.execute(stmt)
    claims = result.scalars().all()

    total_ar = sum(c.balance for c in claims)
    current = days_30 = days_60 = days_90 = days_120 = 0
    total_age = 0

    for c in claims:
        dos = c.date_of_service or (c.created_at.date() if c.created_at else today)
        age = (today - dos).days
        total_age += age
        b = c.balance
        if age <= 30:
            current += b
        elif age <= 60:
            days_30 += b
        elif age <= 90:
            days_60 += b
        elif age <= 120:
            days_90 += b
        else:
            days_120 += b

    avg_days = round(total_age / len(claims)) if claims else 0

    buckets = []
    for label, amount in [
        ("Current (0–30)", current),
        ("31–60 days", days_30),
        ("61–90 days", days_60),
        ("91–120 days", days_90),
        ("120+ days", days_120),
    ]:
        count = sum(1 for c in claims if _age_bucket(
            (today - (c.date_of_service or (c.created_at.date() if c.created_at else today))).days
        ) == label)
        buckets.append({
            "bucket": label,
            "count": count,
            "amount": round(amount, 2),
            "pct": round((amount / total_ar * 100) if total_ar else 0, 1),
        })

    return {
        "total_ar": round(total_ar, 2),
        "current": round(current, 2),
        "days_30": round(days_30, 2),
        "days_60": round(days_60, 2),
        "days_90": round(days_90, 2),
        "days_120_plus": round(days_120, 2),
        "avg_days_outstanding": avg_days,
        "buckets": buckets,
    }


@router.get("/ar/claims")
async def ar_claims(
    payer: Optional[str] = Query(None),
    bucket: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
) -> List[Dict[str, Any]]:
    today = date.today()
    open_statuses = ("submitted", "pending", "partial", "draft")

    stmt = select(Claim).where(
        Claim.tenant_id == ctx.tenant_id,
        Claim.status.in_(open_statuses),
        Claim.balance > 0,
    ).order_by(Claim.date_of_service.asc().nullsfirst()).offset(offset).limit(limit)

    result = await db.execute(stmt)
    claims = result.scalars().all()

    rows = []
    for c in claims:
        dos = c.date_of_service or (c.created_at.date() if c.created_at else today)
        age_days = (today - dos).days
        b = _age_bucket(age_days)

        if bucket and b != bucket:
            continue

        rows.append({
            "id": str(c.id),
            "claim_number": c.claim_number or c.patient_control_number,
            "patient_name": "—",
            "payer_name": str(c.payer_id) if c.payer_id else "Unknown",
            "dos": dos.isoformat(),
            "total_charges": round(c.total_charge, 2),
            "balance": round(c.balance, 2),
            "age_days": age_days,
            "bucket": b,
        })

    return rows
