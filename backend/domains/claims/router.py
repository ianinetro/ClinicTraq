from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from domains.claims.models import Claim, ClaimLine, ClaimStatusEvent, ClaimSubmission, ClaimValidationIssue
from domains.claims.schemas import (
    BatchSubmitRequest,
    ClaimCreate,
    ClaimLifecycleEvent,
    ClaimResponse,
    ClaimUpdate,
    ClaimValidationIssueResponse,
    CMS1500Preview,
)
from domains.claims.validation import ClaimValidator
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import User

router = APIRouter(tags=["claims"])


async def _load_claim(db: AsyncSession, claim_id: uuid.UUID, tenant_id: uuid.UUID) -> Claim:
    result = await db.execute(
        select(Claim)
        .where(Claim.id == claim_id, Claim.tenant_id == tenant_id)
        .options(
            selectinload(Claim.lines),
            selectinload(Claim.validation_issues),
            selectinload(Claim.status_events),
        )
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


@router.get("/claims", response_model=List[ClaimResponse])
async def list_claims(
    patient_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    payer_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    stmt = (
        select(Claim)
        .where(Claim.tenant_id == ctx.tenant_id)
        .options(selectinload(Claim.lines), selectinload(Claim.validation_issues))
    )
    if patient_id:
        stmt = stmt.where(Claim.patient_id == patient_id)
    if status_filter:
        stmt = stmt.where(Claim.status == status_filter)
    if payer_id:
        stmt = stmt.where(Claim.payer_id == payer_id)
    stmt = stmt.offset(offset).limit(limit).order_by(Claim.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/claims", response_model=ClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_claim(
    body: ClaimCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("claims:write")),
):
    from datetime import date
    today = date.today()
    claim_number = f"CT-{today.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    claim = Claim(
        tenant_id=ctx.tenant_id,
        claim_number=claim_number,
        **body.model_dump(),
    )
    db.add(claim)
    await db.flush()
    db.add(ClaimStatusEvent(
        tenant_id=ctx.tenant_id,
        claim_id=claim.id,
        from_status=None,
        to_status="draft",
        changed_by=current_user.id,
        note="Claim created",
    ))
    await db.flush()
    return await _load_claim(db, claim.id, ctx.tenant_id)


@router.get("/claims/repair-queue", response_model=List[ClaimResponse])
async def repair_queue(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    """Return claims that have blocking validation issues or are stale."""
    result = await db.execute(
        select(Claim)
        .where(
            Claim.tenant_id == ctx.tenant_id,
            or_(
                Claim.validation_status == "invalid",
                Claim.status == "rejected",
                Claim.status == "denied",
            ),
        )
        .options(selectinload(Claim.lines), selectinload(Claim.validation_issues))
        .limit(200)
    )
    return result.scalars().all()


@router.get("/claims/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    return await _load_claim(db, claim_id, ctx.tenant_id)


@router.patch("/claims/{claim_id}", response_model=ClaimResponse)
async def update_claim(
    claim_id: uuid.UUID,
    body: ClaimUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("claims:write")),
):
    claim = await _load_claim(db, claim_id, ctx.tenant_id)
    old_status = claim.status
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(claim, k, v)
    if body.status and body.status != old_status:
        db.add(ClaimStatusEvent(
            tenant_id=ctx.tenant_id,
            claim_id=claim.id,
            from_status=old_status,
            to_status=body.status,
            changed_by=current_user.id,
        ))
    await db.flush()
    return await _load_claim(db, claim_id, ctx.tenant_id)


@router.post("/claims/{claim_id}/validate", response_model=List[ClaimValidationIssueResponse])
async def validate_claim(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("claims:write")),
):
    claim = await _load_claim(db, claim_id, ctx.tenant_id)

    # Clear existing unresolved issues
    for issue in claim.validation_issues:
        if not issue.resolved:
            await db.delete(issue)
    await db.flush()

    validator = ClaimValidator(claim, db)
    issues_data = await validator.run_all()

    new_issues = []
    for issue_data in issues_data:
        issue = ClaimValidationIssue(
            tenant_id=ctx.tenant_id,
            claim_id=claim.id,
            **issue_data,
        )
        db.add(issue)
        new_issues.append(issue)

    has_blocking = any(i["severity"] == "blocking" for i in issues_data)
    claim.validation_status = "invalid" if has_blocking else ("warnings" if issues_data else "valid")
    await db.flush()

    return new_issues


@router.get("/claims/{claim_id}/cms1500-preview", response_model=CMS1500Preview)
async def cms1500_preview(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    claim = await _load_claim(db, claim_id, ctx.tenant_id)

    # Load related data
    from domains.patients.models import Patient
    from domains.master_data.models import Provider, Payer, PatientInsurance

    patient_result = await db.execute(select(Patient).where(Patient.id == claim.patient_id))
    patient = patient_result.scalar_one_or_none()

    provider_name = None
    provider_npi = None
    if claim.provider_id:
        prov_result = await db.execute(select(Provider).where(Provider.id == claim.provider_id))
        prov = prov_result.scalar_one_or_none()
        if prov:
            provider_name = f"{prov.first_name} {prov.last_name}"
            provider_npi = prov.npi

    payer_name = None
    if claim.payer_id:
        payer_result = await db.execute(select(Payer).where(Payer.id == claim.payer_id))
        payer = payer_result.scalar_one_or_none()
        if payer:
            payer_name = payer.name

    insured_id = None
    if claim.patient_insurance_id:
        from domains.patients.models import PatientInsurance as PI
        ins_result = await db.execute(select(PI).where(PI.id == claim.patient_insurance_id))
        ins = ins_result.scalar_one_or_none()
        if ins:
            insured_id = getattr(ins, "member_id", None) or getattr(ins, "subscriber_id", None)

    diagnosis_codes = [d.get("icd_code") for d in (claim.diagnoses_snapshot or [])]
    service_lines = [
        {
            "cpt_code": l.cpt_code,
            "modifiers": l.modifiers,
            "units": l.units,
            "charge_amount": float(l.charge_amount),
            "revenue_code": l.revenue_code,
        }
        for l in claim.lines
    ]

    patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Unknown"
    dob = getattr(patient, "date_of_birth", None) or getattr(patient, "dob", None)

    return CMS1500Preview(
        claim_id=str(claim.id),
        patient_control_number=str(claim.id),
        claim_number=claim.claim_number,
        patient_name=patient_name,
        date_of_birth=dob,
        insured_id=insured_id,
        payer_name=payer_name,
        provider_name=provider_name,
        provider_npi=provider_npi,
        date_of_service=claim.date_of_service,
        place_of_service=None,
        diagnosis_codes=diagnosis_codes,
        service_lines=service_lines,
        total_charge=float(claim.total_charge),
    )


@router.get("/claims/{claim_id}/events", response_model=List[ClaimLifecycleEvent])
async def claim_events(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    result = await db.execute(
        select(ClaimStatusEvent)
        .where(ClaimStatusEvent.claim_id == claim_id, ClaimStatusEvent.tenant_id == ctx.tenant_id)
        .order_by(ClaimStatusEvent.changed_at.asc())
    )
    return result.scalars().all()


@router.post("/claims/batch-submit")
async def batch_submit(
    body: BatchSubmitRequest,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("claims:write")),
):
    submitted = []
    errors = []
    for claim_id in body.claim_ids:
        result = await db.execute(
            select(Claim)
            .where(Claim.id == claim_id, Claim.tenant_id == ctx.tenant_id)
            .options(selectinload(Claim.lines), selectinload(Claim.validation_issues))
        )
        claim = result.scalar_one_or_none()
        if not claim:
            errors.append({"claim_id": str(claim_id), "error": "Not found"})
            continue
        if claim.validation_status == "invalid":
            errors.append({"claim_id": str(claim_id), "error": "Claim has blocking validation issues"})
            continue
        old_status = claim.status
        claim.status = "submitted"
        claim.last_submitted_at = datetime.now(timezone.utc)
        db.add(ClaimStatusEvent(
            tenant_id=ctx.tenant_id,
            claim_id=claim.id,
            from_status=old_status,
            to_status="submitted",
            changed_by=current_user.id,
            note="Batch submission",
        ))
        db.add(ClaimSubmission(
            tenant_id=ctx.tenant_id,
            claim_id=claim.id,
            submission_method="electronic",
            clearinghouse=body.clearinghouse,
            submitted_by=current_user.id,
        ))
        submitted.append(str(claim_id))

    await db.flush()
    return {"submitted": submitted, "errors": errors}
