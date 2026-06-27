from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from domains.audit.models import AuditEvent
from domains.audit.schemas import AuditEventResponse, PHIRevealRequest
from domains.identity.dependencies import TenantContext, get_current_user, require_permission
from domains.identity.models import User

router = APIRouter(tags=["audit"])


@router.get("/audit", response_model=List[AuditEventResponse])
async def list_audit_events(
    user_id: Optional[uuid.UUID] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    phi_only: bool = Query(False),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("audit:read")),
):
    stmt = (
        select(AuditEvent)
        .where(AuditEvent.tenant_id == ctx.tenant_id)
        .order_by(AuditEvent.timestamp.desc())
    )
    if user_id:
        stmt = stmt.where(AuditEvent.user_id == user_id)
    if action:
        stmt = stmt.where(AuditEvent.action == action)
    if resource_type:
        stmt = stmt.where(AuditEvent.resource_type == resource_type)
    if date_from:
        stmt = stmt.where(AuditEvent.timestamp >= date_from)
    if date_to:
        stmt = stmt.where(AuditEvent.timestamp <= date_to)
    if phi_only:
        stmt = stmt.where(AuditEvent.phi_accessed == True)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/audit/export")
async def export_audit_csv(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("audit:read")),
):
    stmt = (
        select(AuditEvent)
        .where(AuditEvent.tenant_id == ctx.tenant_id)
        .order_by(AuditEvent.timestamp.desc())
        .limit(10000)
    )
    if date_from:
        stmt = stmt.where(AuditEvent.timestamp >= date_from)
    if date_to:
        stmt = stmt.where(AuditEvent.timestamp <= date_to)
    result = await db.execute(stmt)
    events = result.scalars().all()

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "id", "timestamp", "user_id", "action", "resource_type",
            "resource_id", "ip_address", "phi_accessed",
        ],
    )
    writer.writeheader()
    for e in events:
        writer.writerow({
            "id": str(e.id),
            "timestamp": e.timestamp.isoformat(),
            "user_id": str(e.user_id) if e.user_id else "",
            "action": e.action,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id or "",
            "ip_address": e.ip_address or "",
            "phi_accessed": e.phi_accessed,
        })
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )


@router.post("/audit/phi-reveal", status_code=201)
async def log_phi_reveal(
    body: PHIRevealRequest,
    request: Request,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log a PHI field reveal event for HIPAA audit compliance."""
    event = AuditEvent(
        tenant_id=ctx.tenant_id,
        user_id=current_user.id,
        action="phi_reveal",
        resource_type=body.resource_type,
        resource_id=body.resource_id,
        new_values={"field": body.field_name, "reason": body.reason},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        phi_accessed=True,
    )
    db.add(event)
    await db.flush()
    return {"id": str(event.id), "logged": True}
