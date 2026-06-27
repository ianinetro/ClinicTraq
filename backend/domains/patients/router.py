from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import User
from domains.patients.models import (
    BodyMapAnnotation,
    EligibilityCheck,
    Guarantor,
    Patient,
    PatientInsurance,
)
from domains.patients.schemas import (
    EligibilityCheckResponse,
    PatientCreate,
    PatientInsuranceCreate,
    PatientInsuranceResponse,
    PatientInsuranceUpdate,
    PatientResponse,
    PatientUpdate,
)

router = APIRouter(tags=["patients"])


def _get_fernet():
    from cryptography.fernet import Fernet
    key = settings.FERNET_KEY
    if not key:
        return None
    return Fernet(key.encode() if isinstance(key, str) else key)


def _encrypt_ssn(ssn: Optional[str]) -> Optional[str]:
    if not ssn:
        return None
    f = _get_fernet()
    if not f:
        return ssn  # fallback: store plain (dev only)
    return f.encrypt(ssn.encode()).decode()


def _decrypt_ssn(encrypted: Optional[str]) -> Optional[str]:
    if not encrypted:
        return None
    f = _get_fernet()
    if not f:
        return encrypted
    try:
        return f.decrypt(encrypted.encode()).decode()
    except Exception:
        return None


# ── Patient ───────────────────────────────────────────────────────────────────

@router.get("/patients", response_model=List[PatientResponse])
async def list_patients(
    q: Optional[str] = Query(None, description="Search by name or MRN"),
    is_active: Optional[bool] = Query(True),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    stmt = select(Patient).where(Patient.tenant_id == ctx.tenant_id)
    if is_active is not None:
        stmt = stmt.where(Patient.is_active == is_active)
    if q:
        like = f"%{q}%"
        from sqlalchemy import or_
        stmt = stmt.where(
            or_(
                Patient.first_name.ilike(like),
                Patient.last_name.ilike(like),
                Patient.mrn.ilike(like),
            )
        )
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    patients = result.scalars().all()
    return [PatientResponse.from_orm_with_masking(p) for p in patients]


@router.post("/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    body: PatientCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    ssn_raw = body.ssn
    data = body.model_dump(exclude={"ssn"})
    patient = Patient(
        tenant_id=ctx.tenant_id,
        ssn_encrypted=_encrypt_ssn(ssn_raw),
        **data,
    )
    db.add(patient)
    await db.flush()
    return PatientResponse.from_orm_with_masking(patient, decrypted_ssn=ssn_raw)


@router.get("/patients/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.tenant_id == ctx.tenant_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    decrypted = _decrypt_ssn(patient.ssn_encrypted)
    return PatientResponse.from_orm_with_masking(patient, decrypted_ssn=decrypted)


@router.patch("/patients/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: uuid.UUID,
    body: PatientUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.tenant_id == ctx.tenant_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    ssn_raw = body.ssn
    data = body.model_dump(exclude_none=True, exclude={"ssn"})
    for k, v in data.items():
        setattr(patient, k, v)
    if ssn_raw is not None:
        patient.ssn_encrypted = _encrypt_ssn(ssn_raw)

    await db.flush()
    decrypted = _decrypt_ssn(patient.ssn_encrypted)
    return PatientResponse.from_orm_with_masking(patient, decrypted_ssn=decrypted)


# ── Insurance ─────────────────────────────────────────────────────────────────

@router.get("/patients/{patient_id}/insurance", response_model=List[PatientInsuranceResponse])
async def list_insurance(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    await _get_patient_or_404(db, patient_id, ctx.tenant_id)
    result = await db.execute(
        select(PatientInsurance).where(
            PatientInsurance.patient_id == patient_id,
            PatientInsurance.tenant_id == ctx.tenant_id,
        )
    )
    return result.scalars().all()


@router.post(
    "/patients/{patient_id}/insurance",
    response_model=PatientInsuranceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_insurance(
    patient_id: uuid.UUID,
    body: PatientInsuranceCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    await _get_patient_or_404(db, patient_id, ctx.tenant_id)
    ins = PatientInsurance(
        tenant_id=ctx.tenant_id,
        patient_id=patient_id,
        **body.model_dump(),
    )
    db.add(ins)
    await db.flush()
    return ins


@router.patch(
    "/patients/{patient_id}/insurance/{insurance_id}",
    response_model=PatientInsuranceResponse,
)
async def update_insurance(
    patient_id: uuid.UUID,
    insurance_id: uuid.UUID,
    body: PatientInsuranceUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    result = await db.execute(
        select(PatientInsurance).where(
            PatientInsurance.id == insurance_id,
            PatientInsurance.patient_id == patient_id,
            PatientInsurance.tenant_id == ctx.tenant_id,
        )
    )
    ins = result.scalar_one_or_none()
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance record not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(ins, k, v)
    await db.flush()
    return ins


@router.delete(
    "/patients/{patient_id}/insurance/{insurance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_insurance(
    patient_id: uuid.UUID,
    insurance_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    result = await db.execute(
        select(PatientInsurance).where(
            PatientInsurance.id == insurance_id,
            PatientInsurance.patient_id == patient_id,
            PatientInsurance.tenant_id == ctx.tenant_id,
        )
    )
    ins = result.scalar_one_or_none()
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance record not found")
    await db.delete(ins)
    await db.flush()


# ── Eligibility ───────────────────────────────────────────────────────────────

@router.post(
    "/patients/{patient_id}/insurance/{insurance_id}/check-eligibility",
    response_model=EligibilityCheckResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def check_eligibility(
    patient_id: uuid.UUID,
    insurance_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    from workers.eligibility_checker import check_eligibility as celery_task
    await _get_patient_or_404(db, patient_id, ctx.tenant_id)
    result = await db.execute(
        select(PatientInsurance).where(
            PatientInsurance.id == insurance_id,
            PatientInsurance.patient_id == patient_id,
            PatientInsurance.tenant_id == ctx.tenant_id,
        )
    )
    ins = result.scalar_one_or_none()
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance record not found")

    check = EligibilityCheck(
        tenant_id=ctx.tenant_id,
        patient_id=patient_id,
        patient_insurance_id=insurance_id,
        status="pending",
    )
    db.add(check)
    await db.flush()

    # Enqueue async check
    celery_task.delay(str(check.id), str(ctx.tenant_id))
    return check


# ── Patient activity sub-resources ───────────────────────────────────────────

@router.get("/patients/{patient_id}/visits")
async def patient_visits(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    from domains.visits.models import Visit
    await _get_patient_or_404(db, patient_id, ctx.tenant_id)
    result = await db.execute(
        select(Visit).where(Visit.patient_id == patient_id, Visit.tenant_id == ctx.tenant_id)
    )
    visits = result.scalars().all()
    return [{"id": str(v.id), "date_of_service": str(v.date_of_service), "status": v.status} for v in visits]


@router.get("/patients/{patient_id}/claims")
async def patient_claims(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    from domains.claims.models import Claim
    await _get_patient_or_404(db, patient_id, ctx.tenant_id)
    result = await db.execute(
        select(Claim).where(Claim.patient_id == patient_id, Claim.tenant_id == ctx.tenant_id)
    )
    claims = result.scalars().all()
    return [
        {"id": str(c.id), "claim_number": c.claim_number, "status": c.status, "total_charge": float(c.total_charge or 0)}
        for c in claims
    ]


@router.get("/patients/{patient_id}/payments")
async def patient_payments(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    from domains.payments.models import Payment
    await _get_patient_or_404(db, patient_id, ctx.tenant_id)
    result = await db.execute(
        select(Payment).where(Payment.patient_id == patient_id, Payment.tenant_id == ctx.tenant_id)
    )
    payments = result.scalars().all()
    return [
        {"id": str(p.id), "amount": float(p.amount), "payment_date": str(p.payment_date), "payment_type": p.payment_type}
        for p in payments
    ]


@router.get("/patients/{patient_id}/activity")
async def patient_activity(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    """Unified activity feed: visits + claims + payments ordered by date."""
    from domains.visits.models import Visit
    from domains.claims.models import Claim
    from domains.payments.models import Payment

    await _get_patient_or_404(db, patient_id, ctx.tenant_id)

    visits_result = await db.execute(
        select(Visit).where(Visit.patient_id == patient_id, Visit.tenant_id == ctx.tenant_id)
    )
    claims_result = await db.execute(
        select(Claim).where(Claim.patient_id == patient_id, Claim.tenant_id == ctx.tenant_id)
    )
    payments_result = await db.execute(
        select(Payment).where(Payment.patient_id == patient_id, Payment.tenant_id == ctx.tenant_id)
    )

    activity = []
    for v in visits_result.scalars().all():
        activity.append({"type": "visit", "date": str(v.date_of_service), "id": str(v.id), "summary": v.status})
    for c in claims_result.scalars().all():
        activity.append({"type": "claim", "date": str(c.created_at.date()), "id": str(c.id), "summary": c.claim_number})
    for p in payments_result.scalars().all():
        activity.append({"type": "payment", "date": str(p.payment_date), "id": str(p.id), "summary": f"${p.amount}"})

    activity.sort(key=lambda x: x["date"], reverse=True)
    return activity


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_patient_or_404(
    db: AsyncSession, patient_id: uuid.UUID, tenant_id: uuid.UUID
) -> Patient:
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.tenant_id == tenant_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient
