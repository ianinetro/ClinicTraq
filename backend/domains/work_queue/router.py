from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import User
from domains.work_queue.models import (
    WORK_ITEM_STATUS_OPEN,
    WORK_ITEM_STATUS_IN_PROGRESS,
    WORK_ITEM_STATUS_RESOLVED,
    WORK_ITEM_PRIORITY_URGENT,
    ALL_WORK_ITEM_TYPES,
    DenialAppeal,
    WorkItem,
    WorkItemNote,
)
from domains.work_queue.schemas import (
    DenialAppealCreate,
    DenialAppealResponse,
    DenialAppealUpdate,
    WorkItemCreate,
    WorkItemNoteCreate,
    WorkItemNoteResponse,
    WorkItemResponse,
    WorkItemUpdate,
    WorkQueueSummary,
)

router = APIRouter(tags=["work_queue"])

_STALE_DAYS = 10  # items older than this without action get escalated


async def _escalate_stale_items(db: AsyncSession, tenant_id: uuid.UUID):
    """Escalate items that haven't been actioned in > STALE_DAYS days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=_STALE_DAYS)
    result = await db.execute(
        select(WorkItem).where(
            WorkItem.tenant_id == tenant_id,
            WorkItem.status.in_([WORK_ITEM_STATUS_OPEN, WORK_ITEM_STATUS_IN_PROGRESS]),
            WorkItem.escalated == False,
            WorkItem.created_at < cutoff,
            (WorkItem.last_action_at == None) | (WorkItem.last_action_at < cutoff),
        )
    )
    stale = result.scalars().all()
    for item in stale:
        item.escalated = True
        item.escalated_at = datetime.now(timezone.utc)
        if item.priority != WORK_ITEM_PRIORITY_URGENT:
            # Bump priority one level
            priority_order = ["low", "normal", "high", "urgent"]
            idx = priority_order.index(item.priority) if item.priority in priority_order else 1
            item.priority = priority_order[min(idx + 1, 3)]
    if stale:
        await db.flush()


@router.get("/work-queue", response_model=List[WorkItemResponse])
async def list_work_items(
    item_type: Optional[str] = Query(None),
    item_status: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    assigned_to: Optional[uuid.UUID] = Query(None),
    escalated: Optional[bool] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("work_queue:read")),
):
    # Escalate stale items on each list request
    await _escalate_stale_items(db, ctx.tenant_id)

    stmt = (
        select(WorkItem)
        .where(WorkItem.tenant_id == ctx.tenant_id)
        .options(selectinload(WorkItem.notes))
    )
    if item_type:
        stmt = stmt.where(WorkItem.item_type == item_type)
    if item_status:
        stmt = stmt.where(WorkItem.status == item_status)
    if priority:
        stmt = stmt.where(WorkItem.priority == priority)
    if assigned_to:
        stmt = stmt.where(WorkItem.assigned_to == assigned_to)
    if escalated is not None:
        stmt = stmt.where(WorkItem.escalated == escalated)
    stmt = stmt.offset(offset).limit(limit).order_by(WorkItem.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/work-queue/summary", response_model=WorkQueueSummary)
async def work_queue_summary(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("work_queue:read")),
):
    await _escalate_stale_items(db, ctx.tenant_id)

    # Total open
    open_result = await db.execute(
        select(func.count(WorkItem.id)).where(
            WorkItem.tenant_id == ctx.tenant_id,
            WorkItem.status.in_([WORK_ITEM_STATUS_OPEN, WORK_ITEM_STATUS_IN_PROGRESS]),
        )
    )
    total_open = open_result.scalar() or 0

    # Total escalated
    esc_result = await db.execute(
        select(func.count(WorkItem.id)).where(
            WorkItem.tenant_id == ctx.tenant_id,
            WorkItem.escalated == True,
            WorkItem.status.in_([WORK_ITEM_STATUS_OPEN, WORK_ITEM_STATUS_IN_PROGRESS]),
        )
    )
    total_escalated = esc_result.scalar() or 0

    # By type
    type_result = await db.execute(
        select(WorkItem.item_type, func.count(WorkItem.id)).where(
            WorkItem.tenant_id == ctx.tenant_id,
            WorkItem.status.in_([WORK_ITEM_STATUS_OPEN, WORK_ITEM_STATUS_IN_PROGRESS]),
        ).group_by(WorkItem.item_type)
    )
    by_type = {row[0]: row[1] for row in type_result.all()}

    # By priority
    prio_result = await db.execute(
        select(WorkItem.priority, func.count(WorkItem.id)).where(
            WorkItem.tenant_id == ctx.tenant_id,
            WorkItem.status.in_([WORK_ITEM_STATUS_OPEN, WORK_ITEM_STATUS_IN_PROGRESS]),
        ).group_by(WorkItem.priority)
    )
    by_priority = {row[0]: row[1] for row in prio_result.all()}

    return WorkQueueSummary(
        total_open=total_open,
        total_escalated=total_escalated,
        by_type=by_type,
        by_priority=by_priority,
    )


@router.post("/work-queue", response_model=WorkItemResponse, status_code=status.HTTP_201_CREATED)
async def create_work_item(
    body: WorkItemCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("work_queue:write")),
):
    item = WorkItem(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(item)
    await db.flush()
    return item


@router.get("/work-queue/{item_id}", response_model=WorkItemResponse)
async def get_work_item(
    item_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("work_queue:read")),
):
    result = await db.execute(
        select(WorkItem)
        .where(WorkItem.id == item_id, WorkItem.tenant_id == ctx.tenant_id)
        .options(selectinload(WorkItem.notes))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    return item


@router.patch("/work-queue/{item_id}", response_model=WorkItemResponse)
async def update_work_item(
    item_id: uuid.UUID,
    body: WorkItemUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("work_queue:write")),
):
    result = await db.execute(
        select(WorkItem)
        .where(WorkItem.id == item_id, WorkItem.tenant_id == ctx.tenant_id)
        .options(selectinload(WorkItem.notes))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")

    for k, v in body.model_dump(exclude_none=True).items():
        setattr(item, k, v)

    item.last_action_at = datetime.now(timezone.utc)

    if body.status == WORK_ITEM_STATUS_RESOLVED:
        item.resolved_at = datetime.now(timezone.utc)
        item.resolved_by = current_user.id

    await db.flush()
    return item


@router.post("/work-queue/{item_id}/notes", response_model=WorkItemNoteResponse, status_code=status.HTTP_201_CREATED)
async def add_note(
    item_id: uuid.UUID,
    body: WorkItemNoteCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("work_queue:write")),
):
    result = await db.execute(
        select(WorkItem).where(WorkItem.id == item_id, WorkItem.tenant_id == ctx.tenant_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")

    note = WorkItemNote(
        tenant_id=ctx.tenant_id,
        work_item_id=item_id,
        content=body.content,
        created_by=current_user.id,
    )
    db.add(note)
    item.last_action_at = datetime.now(timezone.utc)
    await db.flush()
    return note


# ── DenialAppeal endpoints ────────────────────────────────────────────────────

@router.post("/claims/{claim_id}/denial", response_model=DenialAppealResponse, status_code=status.HTTP_201_CREATED)
async def create_denial_appeal(
    claim_id: uuid.UUID,
    body: DenialAppealCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:write")),
):
    appeal = DenialAppeal(
        tenant_id=ctx.tenant_id,
        claim_id=claim_id,
        **body.model_dump(),
    )
    db.add(appeal)
    await db.flush()
    return appeal


@router.get("/claims/{claim_id}/denials", response_model=List[DenialAppealResponse])
async def list_denial_appeals(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    result = await db.execute(
        select(DenialAppeal).where(
            DenialAppeal.tenant_id == ctx.tenant_id,
            DenialAppeal.claim_id == claim_id,
        ).order_by(DenialAppeal.created_at.desc())
    )
    return result.scalars().all()


@router.patch("/denials/{denial_id}", response_model=DenialAppealResponse)
async def update_denial_appeal(
    denial_id: uuid.UUID,
    body: DenialAppealUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:write")),
):
    result = await db.execute(
        select(DenialAppeal).where(
            DenialAppeal.id == denial_id,
            DenialAppeal.tenant_id == ctx.tenant_id,
        )
    )
    appeal = result.scalar_one_or_none()
    if not appeal:
        raise HTTPException(status_code=404, detail="Denial appeal not found")

    for k, v in body.model_dump(exclude_none=True).items():
        setattr(appeal, k, v)

    await db.flush()
    return appeal
