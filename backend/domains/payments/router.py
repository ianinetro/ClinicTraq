from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import User
from domains.payments.models import (
    Adjustment,
    ERAFile,
    ERAPayment,
    Payment,
    PaymentApplication,
)
from domains.payments.schemas import (
    AutoPostRequest,
    ERAFileCreate,
    ERAFileResponse,
    ERAPaymentResponse,
    ManualMatchRequest,
    PaymentApplicationCreate,
    PaymentApplicationResponse,
    PaymentCreate,
    PaymentResponse,
    PaymentUpdate,
    ReversalRequest,
)

router = APIRouter(tags=["payments"])


@router.get("/payments", response_model=List[PaymentResponse])
async def list_payments(
    patient_id: Optional[uuid.UUID] = Query(None),
    payer_id: Optional[uuid.UUID] = Query(None),
    payment_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("payments:read")),
):
    stmt = select(Payment).where(Payment.tenant_id == ctx.tenant_id)
    if patient_id:
        stmt = stmt.where(Payment.patient_id == patient_id)
    if payer_id:
        stmt = stmt.where(Payment.payer_id == payer_id)
    if payment_type:
        stmt = stmt.where(Payment.payment_type == payment_type)
    stmt = stmt.offset(offset).limit(limit).order_by(Payment.payment_date.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    body: PaymentCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payments:write")),
):
    payment = Payment(
        tenant_id=ctx.tenant_id,
        posted_by=current_user.id,
        unapplied_amount=body.amount,
        **body.model_dump(),
    )
    db.add(payment)
    await db.flush()
    return payment


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("payments:read")),
):
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.tenant_id == ctx.tenant_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    return p


@router.patch("/payments/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: uuid.UUID,
    body: PaymentUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("payments:write")),
):
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.tenant_id == ctx.tenant_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if p.is_reversed:
        raise HTTPException(status_code=400, detail="Cannot edit a reversed payment")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    await db.flush()
    return p


@router.post("/payments/{payment_id}/apply", response_model=PaymentApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_payment(
    payment_id: uuid.UUID,
    body: PaymentApplicationCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payments:write")),
):
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.tenant_id == ctx.tenant_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if body.amount_applied > float(payment.unapplied_amount) + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot apply {body.amount_applied} — only {payment.unapplied_amount} unapplied",
        )

    app = PaymentApplication(
        tenant_id=ctx.tenant_id,
        payment_id=payment_id,
        claim_id=body.claim_id,
        claim_line_id=body.claim_line_id,
        amount_applied=body.amount_applied,
        adjustment_amount=body.adjustment_amount,
        adjustment_code=body.adjustment_code,
        adjustment_reason=body.adjustment_reason,
    )
    db.add(app)

    payment.unapplied_amount = float(payment.unapplied_amount) - body.amount_applied

    # Update claim balance if claim_id provided
    if body.claim_id:
        from domains.claims.models import Claim
        claim_result = await db.execute(
            select(Claim).where(Claim.id == body.claim_id, Claim.tenant_id == ctx.tenant_id)
        )
        claim = claim_result.scalar_one_or_none()
        if claim:
            claim.total_paid = float(claim.total_paid) + body.amount_applied
            claim.total_adjustment = float(claim.total_adjustment) + body.adjustment_amount
            claim.balance = float(claim.total_charge) - float(claim.total_paid) - float(claim.total_adjustment)

    await db.flush()
    return app


@router.post("/payments/{payment_id}/unapply/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unapply_payment(
    payment_id: uuid.UUID,
    application_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("payments:write")),
):
    """Fully editable — any posting item can be unapplied."""
    result = await db.execute(
        select(PaymentApplication).where(
            PaymentApplication.id == application_id,
            PaymentApplication.payment_id == payment_id,
            PaymentApplication.tenant_id == ctx.tenant_id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Restore unapplied amount on payment
    payment_result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.tenant_id == ctx.tenant_id)
    )
    payment = payment_result.scalar_one_or_none()
    if payment:
        payment.unapplied_amount = float(payment.unapplied_amount) + float(app.amount_applied)

    # Reverse claim balance
    if app.claim_id:
        from domains.claims.models import Claim
        claim_result = await db.execute(
            select(Claim).where(Claim.id == app.claim_id, Claim.tenant_id == ctx.tenant_id)
        )
        claim = claim_result.scalar_one_or_none()
        if claim:
            claim.total_paid = float(claim.total_paid) - float(app.amount_applied)
            claim.total_adjustment = float(claim.total_adjustment) - float(app.adjustment_amount)
            claim.balance = float(claim.total_charge) - float(claim.total_paid) - float(claim.total_adjustment)

    await db.delete(app)
    await db.flush()


@router.post("/payments/{payment_id}/reverse", response_model=PaymentResponse)
async def reverse_payment(
    payment_id: uuid.UUID,
    body: ReversalRequest,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payments:write")),
):
    """Create an offsetting reversal payment. Does not delete original (clean audit trail)."""
    result = await db.execute(
        select(Payment)
        .where(Payment.id == payment_id, Payment.tenant_id == ctx.tenant_id)
        .options(selectinload(Payment.applications))
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Payment not found")
    if original.is_reversed:
        raise HTTPException(status_code=400, detail="Payment is already reversed")

    # Mark all existing applications as reversed
    for app in original.applications:
        app.is_reversed = True
        if app.claim_id:
            from domains.claims.models import Claim
            claim_result = await db.execute(
                select(Claim).where(Claim.id == app.claim_id, Claim.tenant_id == ctx.tenant_id)
            )
            claim = claim_result.scalar_one_or_none()
            if claim:
                claim.total_paid = float(claim.total_paid) - float(app.amount_applied)
                claim.balance = float(claim.total_charge) - float(claim.total_paid) - float(claim.total_adjustment)

    # Create offsetting payment with negative amount
    reversal = Payment(
        tenant_id=ctx.tenant_id,
        patient_id=original.patient_id,
        payer_id=original.payer_id,
        payment_date=original.payment_date,
        payment_type=original.payment_type,
        payment_method=original.payment_method,
        amount=-float(original.amount),
        unapplied_amount=0,
        notes=f"Reversal of payment {payment_id}. {body.reason or ''}",
        reversal_of_id=payment_id,
        posted_by=current_user.id,
    )
    db.add(reversal)
    original.is_reversed = True
    original.reversed_by_id = reversal.id
    await db.flush()
    return reversal


# ── ERA ───────────────────────────────────────────────────────────────────────

@router.post("/era/upload", response_model=ERAFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_era(
    body: ERAFileCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payments:write")),
):
    era_file = ERAFile(
        tenant_id=ctx.tenant_id,
        payer_id=body.payer_id,
        file_name=body.file_name,
        raw_content=body.raw_content,
        status="pending",
        imported_by=current_user.id,
    )
    db.add(era_file)
    await db.flush()

    # Enqueue import task
    from workers.era_importer import import_era
    import_era.delay(str(era_file.id), str(ctx.tenant_id))

    return era_file


@router.get("/era/{era_file_id}/payments", response_model=List[ERAPaymentResponse])
async def list_era_payments(
    era_file_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("payments:read")),
):
    result = await db.execute(
        select(ERAPayment).where(
            ERAPayment.era_file_id == era_file_id,
            ERAPayment.tenant_id == ctx.tenant_id,
        )
    )
    return result.scalars().all()


@router.post("/era/auto-post")
async def auto_post_era(
    body: AutoPostRequest,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payments:write")),
):
    """Auto-post ERA payments with match_confidence >= min_confidence."""
    result = await db.execute(
        select(ERAPayment).where(
            ERAPayment.era_file_id == body.era_file_id,
            ERAPayment.tenant_id == ctx.tenant_id,
            ERAPayment.match_status == "matched",
            ERAPayment.match_confidence >= body.min_confidence,
        )
    )
    era_payments = result.scalars().all()

    posted = 0
    for ep in era_payments:
        if not ep.claim_id or not ep.paid_amount:
            continue
        payment = Payment(
            tenant_id=ctx.tenant_id,
            payer_id=None,
            payment_date=ep.dos or datetime.now(timezone.utc).date(),
            payment_type="era",
            amount=ep.paid_amount,
            unapplied_amount=0,
            era_file_id=body.era_file_id,
            posted_by=current_user.id,
        )
        db.add(payment)
        await db.flush()

        app = PaymentApplication(
            tenant_id=ctx.tenant_id,
            payment_id=payment.id,
            claim_id=ep.claim_id,
            amount_applied=float(ep.paid_amount),
        )
        db.add(app)

        from domains.claims.models import Claim
        claim_result = await db.execute(
            select(Claim).where(Claim.id == ep.claim_id, Claim.tenant_id == ctx.tenant_id)
        )
        claim = claim_result.scalar_one_or_none()
        if claim:
            claim.total_paid = float(claim.total_paid) + float(ep.paid_amount)
            claim.balance = float(claim.total_charge) - float(claim.total_paid)

        ep.match_status = "auto_posted"
        ep.payment_id = payment.id
        posted += 1

    await db.flush()
    return {"posted": posted}


@router.post("/era/manual-match", status_code=status.HTTP_204_NO_CONTENT)
async def manual_match(
    body: ManualMatchRequest,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("payments:write")),
):
    result = await db.execute(
        select(ERAPayment).where(
            ERAPayment.id == body.era_payment_id,
            ERAPayment.tenant_id == ctx.tenant_id,
        )
    )
    ep = result.scalar_one_or_none()
    if not ep:
        raise HTTPException(status_code=404, detail="ERA payment not found")
    ep.claim_id = body.claim_id
    ep.match_status = "matched"
    ep.match_confidence = 1.0
    await db.flush()
