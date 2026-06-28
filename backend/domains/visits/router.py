from __future__ import annotations

import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import User
from domains.visits.billing_validation import BillingValidator
from domains.visits.models import ChargeLine, Order, Visit, VisitBillingOptions, VisitDiagnosis, VisitNote, VitalSigns
from domains.visits.schemas import (
    BillingIssue,
    ChargeLineCreate,
    ChargeLineResponse,
    ChargeLineUpdate,
    OrderCreate,
    OrderResponse,
    VisitBillingOptionsCreate,
    VisitBillingOptionsResponse,
    VisitBillingOptionsUpdate,
    VisitCreate,
    VisitDiagnosisCreate,
    VisitDiagnosisResponse,
    VisitNoteCreate,
    VisitNoteResponse,
    VisitResponse,
    VisitUpdate,
    VitalSignsCreate,
    VitalSignsResponse,
)

router = APIRouter(tags=["visits"])

validator = BillingValidator()


async def _require_visit(visit_id: uuid.UUID, ctx: TenantContext, db: AsyncSession) -> Visit:
    result = await db.execute(
        select(Visit)
        .where(Visit.id == visit_id, Visit.tenant_id == ctx.tenant_id)
        .options(
            selectinload(Visit.diagnoses),
            selectinload(Visit.charge_lines),
        )
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return visit


# ── Visits ────────────────────────────────────────────────────────────────────

@router.get("/visits", response_model=List[VisitResponse])
async def list_visits(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    patient_id: Optional[uuid.UUID] = Query(None),
    provider_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    q = select(Visit).where(Visit.tenant_id == ctx.tenant_id)
    if date_from:
        q = q.where(Visit.visit_date >= date_from)
    if date_to:
        q = q.where(Visit.visit_date <= date_to)
    if patient_id:
        q = q.where(Visit.patient_id == patient_id)
    if provider_id:
        q = q.where(Visit.provider_id == provider_id)
    if status:
        q = q.where(Visit.status == status)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/visits", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
async def create_visit(
    body: VisitCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    visit = Visit(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(visit)
    await db.flush()
    return visit


@router.get("/visits/{visit_id}", response_model=VisitResponse)
async def get_visit(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    return await _require_visit(visit_id, ctx, db)


@router.patch("/visits/{visit_id}", response_model=VisitResponse)
async def update_visit(
    visit_id: uuid.UUID,
    body: VisitUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    visit = await _require_visit(visit_id, ctx, db)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(visit, k, v)
    await db.flush()
    return visit


# ── Diagnoses ─────────────────────────────────────────────────────────────────

@router.post("/visits/{visit_id}/diagnoses", response_model=VisitDiagnosisResponse, status_code=status.HTTP_201_CREATED)
async def add_diagnosis(
    visit_id: uuid.UUID,
    body: VisitDiagnosisCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    await _require_visit(visit_id, ctx, db)
    obj = VisitDiagnosis(visit_id=visit_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/visits/{visit_id}/diagnoses/{d_id}", response_model=VisitDiagnosisResponse)
async def update_diagnosis(
    visit_id: uuid.UUID,
    d_id: uuid.UUID,
    body: VisitDiagnosisCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    await _require_visit(visit_id, ctx, db)
    result = await db.execute(
        select(VisitDiagnosis).where(VisitDiagnosis.id == d_id, VisitDiagnosis.visit_id == visit_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/visits/{visit_id}/diagnoses/{d_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_diagnosis(
    visit_id: uuid.UUID,
    d_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    await _require_visit(visit_id, ctx, db)
    result = await db.execute(
        select(VisitDiagnosis).where(VisitDiagnosis.id == d_id, VisitDiagnosis.visit_id == visit_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    await db.delete(obj)


# ── Charge Lines ──────────────────────────────────────────────────────────────

@router.get("/visits/{visit_id}/charge-lines", response_model=List[ChargeLineResponse])
async def list_charge_lines(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    await _require_visit(visit_id, ctx, db)
    result = await db.execute(
        select(ChargeLine).where(ChargeLine.visit_id == visit_id).order_by(ChargeLine.sequence)
    )
    lines = result.scalars().all()
    return [ChargeLineResponse.model_validate(line) for line in lines]


@router.post("/visits/{visit_id}/charge-lines", response_model=ChargeLineResponse, status_code=status.HTTP_201_CREATED)
async def add_charge_line(
    visit_id: uuid.UUID,
    body: ChargeLineCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    await _require_visit(visit_id, ctx, db)
    obj = ChargeLine(visit_id=visit_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return ChargeLineResponse.model_validate(obj)


@router.patch("/visits/{visit_id}/charge-lines/{line_id}", response_model=ChargeLineResponse)
async def update_charge_line(
    visit_id: uuid.UUID,
    line_id: uuid.UUID,
    body: ChargeLineUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    await _require_visit(visit_id, ctx, db)
    result = await db.execute(
        select(ChargeLine).where(ChargeLine.id == line_id, ChargeLine.visit_id == visit_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Charge line not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return ChargeLineResponse.model_validate(obj)


@router.delete("/visits/{visit_id}/charge-lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_charge_line(
    visit_id: uuid.UUID,
    line_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    await _require_visit(visit_id, ctx, db)
    result = await db.execute(
        select(ChargeLine).where(ChargeLine.id == line_id, ChargeLine.visit_id == visit_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Charge line not found")
    await db.delete(obj)


# ── Billing Options ───────────────────────────────────────────────────────────

@router.get("/visits/{visit_id}/billing-options", response_model=VisitBillingOptionsResponse)
async def get_billing_options(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    result = await db.execute(
        select(VisitBillingOptions).where(VisitBillingOptions.visit_id == visit_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Billing options not set for this visit")
    return obj


@router.patch("/visits/{visit_id}/billing-options", response_model=VisitBillingOptionsResponse)
async def upsert_billing_options(
    visit_id: uuid.UUID,
    body: VisitBillingOptionsUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    await _require_visit(visit_id, ctx, db)
    result = await db.execute(
        select(VisitBillingOptions).where(VisitBillingOptions.visit_id == visit_id)
    )
    obj = result.scalar_one_or_none()
    if obj:
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(obj, k, v)
    else:
        obj = VisitBillingOptions(visit_id=visit_id, **body.model_dump())
        db.add(obj)
    await db.flush()
    return obj


# ── Validate Billing ──────────────────────────────────────────────────────────

@router.post("/visits/{visit_id}/validate-billing", response_model=List[BillingIssue])
async def validate_billing(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    visit = await _require_visit(visit_id, ctx, db)
    issues = validator.validate(visit, visit.charge_lines)
    return [BillingIssue(**issue) for issue in issues]


# ── Create Claim ──────────────────────────────────────────────────────────────

@router.post("/visits/{visit_id}/create-claim")
async def create_claim_from_visit(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    visit = await _require_visit(visit_id, ctx, db)
    # Validate before creating
    issues = validator.validate(visit, visit.charge_lines)
    errors = [i for i in issues if i["severity"] == "error"]
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Visit has billing errors that must be resolved.", "errors": errors},
        )
    # Stub: return placeholder claim_id until claims domain is integrated
    return {"claim_id": None, "message": "Claim creation requires the claims domain to be initialized."}


# ── Notes ─────────────────────────────────────────────────────────────────────

@router.get("/visits/{visit_id}/notes", response_model=List[VisitNoteResponse])
async def list_notes(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    await _require_visit(visit_id, ctx, db)
    result = await db.execute(
        select(VisitNote).where(VisitNote.visit_id == visit_id).order_by(VisitNote.created_at)
    )
    return result.scalars().all()


@router.post("/visits/{visit_id}/notes", response_model=VisitNoteResponse, status_code=status.HTTP_201_CREATED)
async def add_note(
    visit_id: uuid.UUID,
    body: VisitNoteCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("visits:write")),
):
    await _require_visit(visit_id, ctx, db)
    obj = VisitNote(visit_id=visit_id, author_id=current_user.id, note=body.note)
    db.add(obj)
    await db.flush()
    return obj


# ── Vital Signs ───────────────────────────────────────────────────────────────

@router.get("/visits/{visit_id}/vitals", response_model=List[VitalSignsResponse])
async def list_vitals(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    await _require_visit(visit_id, ctx, db)
    result = await db.execute(
        select(VitalSigns)
        .where(VitalSigns.visit_id == visit_id, VitalSigns.tenant_id == ctx.tenant_id)
        .order_by(VitalSigns.recorded_at)
    )
    return result.scalars().all()


@router.post("/visits/{visit_id}/vitals", response_model=VitalSignsResponse, status_code=status.HTTP_201_CREATED)
async def create_vitals(
    visit_id: uuid.UUID,
    body: VitalSignsCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("visits:write")),
):
    await _require_visit(visit_id, ctx, db)
    data = body.model_dump()
    data["visit_id"] = visit_id
    obj = VitalSigns(tenant_id=ctx.tenant_id, recorded_by=current_user.id, **data)
    db.add(obj)
    await db.flush()
    return obj


# ── Orders ────────────────────────────────────────────────────────────────────

@router.get("/visits/{visit_id}/orders", response_model=List[OrderResponse])
async def list_orders(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    await _require_visit(visit_id, ctx, db)
    result = await db.execute(
        select(Order)
        .where(Order.visit_id == visit_id, Order.tenant_id == ctx.tenant_id)
        .order_by(Order.ordered_at)
    )
    return result.scalars().all()


@router.post("/visits/{visit_id}/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    visit_id: uuid.UUID,
    body: OrderCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("visits:write")),
):
    await _require_visit(visit_id, ctx, db)
    data = body.model_dump()
    data["visit_id"] = visit_id
    obj = Order(tenant_id=ctx.tenant_id, ordered_by=current_user.id, **data)
    db.add(obj)
    await db.flush()
    return obj
