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
from domains.visits.models import ChargeLine, Visit, VisitBillingOptions, VisitDiagnosis, VisitNote
from domains.visits.schemas import (
    BillingValidationIssue,
    BillingValidationResponse,
    ChargeLineCreate,
    VisitCreate,
    VisitDiagnosisCreate,
    VisitResponse,
    VisitUpdate,
)

router = APIRouter(tags=["visits"])


async def _load_visit(db: AsyncSession, visit_id: uuid.UUID, tenant_id: uuid.UUID) -> Visit:
    result = await db.execute(
        select(Visit)
        .where(Visit.id == visit_id, Visit.tenant_id == tenant_id)
        .options(
            selectinload(Visit.diagnoses),
            selectinload(Visit.charge_lines),
            selectinload(Visit.billing_options),
        )
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return visit


@router.get("/visits", response_model=List[VisitResponse])
async def list_visits(
    patient_id: Optional[uuid.UUID] = Query(None),
    provider_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    stmt = (
        select(Visit)
        .where(Visit.tenant_id == ctx.tenant_id)
        .options(selectinload(Visit.diagnoses), selectinload(Visit.charge_lines))
    )
    if patient_id:
        stmt = stmt.where(Visit.patient_id == patient_id)
    if provider_id:
        stmt = stmt.where(Visit.provider_id == provider_id)
    if status_filter:
        stmt = stmt.where(Visit.status == status_filter)
    if date_from:
        stmt = stmt.where(Visit.date_of_service >= date_from)
    if date_to:
        stmt = stmt.where(Visit.date_of_service <= date_to)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/visits", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
async def create_visit(
    body: VisitCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("visits:write")),
):
    visit_data = body.model_dump(exclude={"diagnoses", "charge_lines", "billing_options"})
    visit = Visit(tenant_id=ctx.tenant_id, **visit_data)
    db.add(visit)
    await db.flush()

    for i, dx in enumerate(body.diagnoses):
        diag = VisitDiagnosis(
            tenant_id=ctx.tenant_id,
            visit_id=visit.id,
            **dx.model_dump(),
        )
        db.add(diag)

    for i, cl in enumerate(body.charge_lines):
        charge = ChargeLine(
            tenant_id=ctx.tenant_id,
            visit_id=visit.id,
            sequence=i + 1,
            **cl.model_dump(),
        )
        db.add(charge)

    if body.billing_options:
        bo = VisitBillingOptions(
            tenant_id=ctx.tenant_id,
            visit_id=visit.id,
            **body.billing_options.model_dump(),
        )
        db.add(bo)

    await db.flush()
    return await _load_visit(db, visit.id, ctx.tenant_id)


@router.get("/visits/{visit_id}", response_model=VisitResponse)
async def get_visit(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    return await _load_visit(db, visit_id, ctx.tenant_id)


@router.patch("/visits/{visit_id}", response_model=VisitResponse)
async def update_visit(
    visit_id: uuid.UUID,
    body: VisitUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:write")),
):
    visit = await _load_visit(db, visit_id, ctx.tenant_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(visit, k, v)
    await db.flush()
    return await _load_visit(db, visit_id, ctx.tenant_id)


@router.post("/visits/{visit_id}/validate-billing", response_model=BillingValidationResponse)
async def validate_billing(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("visits:read")),
):
    visit = await _load_visit(db, visit_id, ctx.tenant_id)
    issues: List[BillingValidationIssue] = []
    today = date.today()

    # Future date of service
    if visit.date_of_service > today:
        issues.append(BillingValidationIssue(
            severity="error",
            code="FUTURE_DOS",
            message=f"Date of service {visit.date_of_service} is in the future.",
        ))

    # Hospital claim admit code logic
    if visit.claim_type == "institutional":
        if not visit.admit_code:
            issues.append(BillingValidationIssue(
                severity="warning",
                code="MISSING_ADMIT_CODE",
                message="Hospital claims should have an admit type code (UB-04 FL 14).",
            ))
        if not visit.discharge_code:
            issues.append(BillingValidationIssue(
                severity="error",
                code="MISSING_DISCHARGE_CODE",
                message="Inpatient claims require a patient discharge status code (UB-04 FL 17).",
            ))
        # Duplicate admit code check: any other visit for this patient with same admit_code
        if visit.admit_code:
            dup_result = await db.execute(
                select(Visit).where(
                    Visit.patient_id == visit.patient_id,
                    Visit.tenant_id == ctx.tenant_id,
                    Visit.admit_code == visit.admit_code,
                    Visit.id != visit_id,
                    Visit.status != "cancelled",
                )
            )
            dups = dup_result.scalars().all()
            if dups:
                issues.append(BillingValidationIssue(
                    severity="warning",
                    code="DUPLICATE_ADMIT_CODE",
                    message=f"Patient already has another visit with admit code '{visit.admit_code}'. Possible duplicate.",
                ))

    # No diagnoses
    if not visit.diagnoses:
        issues.append(BillingValidationIssue(
            severity="error",
            code="MISSING_DIAGNOSIS",
            message="Visit has no diagnosis codes.",
        ))

    # No charge lines
    if not visit.charge_lines:
        issues.append(BillingValidationIssue(
            severity="error",
            code="MISSING_CHARGES",
            message="Visit has no charge lines.",
        ))

    # Admit date after discharge date
    if visit.admit_date and visit.discharge_date and visit.admit_date > visit.discharge_date:
        issues.append(BillingValidationIssue(
            severity="error",
            code="ADMIT_AFTER_DISCHARGE",
            message="Admit date cannot be after discharge date.",
        ))

    valid = not any(i.severity == "error" for i in issues)
    return BillingValidationResponse(valid=valid, issues=issues)


@router.post("/visits/{visit_id}/create-claim", status_code=status.HTTP_201_CREATED)
async def create_claim_from_visit(
    visit_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("claims:write")),
):
    from domains.claims.models import Claim, ClaimLine, ClaimStatusEvent
    from datetime import datetime, timezone

    visit = await _load_visit(db, visit_id, ctx.tenant_id)

    if visit.status == "billed":
        raise HTTPException(status_code=400, detail="Visit has already been billed")

    if not visit.charge_lines:
        raise HTTPException(status_code=400, detail="Visit has no charge lines")

    # Determine payer from billing options
    payer_id = None
    insurance_id = None
    if visit.billing_options and visit.billing_options.primary_insurance_id:
        insurance_id = visit.billing_options.primary_insurance_id
        from domains.patients.models import PatientInsurance
        ins_result = await db.execute(
            select(PatientInsurance).where(PatientInsurance.id == insurance_id)
        )
        ins = ins_result.scalar_one_or_none()
        if ins:
            payer_id = ins.payer_id

    total_charge = sum(float(cl.charge_amount) * cl.units for cl in visit.charge_lines)

    claim = Claim(
        tenant_id=ctx.tenant_id,
        patient_id=visit.patient_id,
        visit_id=visit.id,
        provider_id=visit.provider_id,
        payer_id=payer_id,
        patient_insurance_id=insurance_id,
        claim_type=visit.claim_type,
        date_of_service=visit.date_of_service,
        admit_date=visit.admit_date,
        discharge_date=visit.discharge_date,
        admit_code=visit.admit_code,
        discharge_code=visit.discharge_code,
        total_charge=total_charge,
        status="draft",
        validation_status="pending",
    )
    db.add(claim)
    await db.flush()

    # Copy diagnoses as JSON on claim
    diag_list = [{"icd_code": d.icd_code, "sequence": d.sequence} for d in visit.diagnoses]
    claim.diagnoses_snapshot = diag_list

    for cl in visit.charge_lines:
        claim_line = ClaimLine(
            tenant_id=ctx.tenant_id,
            claim_id=claim.id,
            cpt_code=cl.cpt_code,
            modifiers=cl.modifiers,
            units=cl.units,
            charge_amount=cl.charge_amount,
            revenue_code=cl.revenue_code,
            diagnosis_pointers=cl.diagnosis_pointers,
            sequence=cl.sequence,
        )
        db.add(claim_line)

    # Status event
    db.add(ClaimStatusEvent(
        tenant_id=ctx.tenant_id,
        claim_id=claim.id,
        from_status=None,
        to_status="draft",
        changed_by=current_user.id,
        note="Claim created from visit",
    ))

    visit.status = "billed"
    await db.flush()

    return {"id": str(claim.id), "claim_number": claim.claim_number, "status": claim.status}
