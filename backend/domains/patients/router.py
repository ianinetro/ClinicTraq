from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from cryptography.fernet import Fernet, InvalidToken
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
    BodyMapAnnotationCreate,
    BodyMapAnnotationResponse,
    EligibilityCheckResponse,
    GuarantorCreate,
    GuarantorResponse,
    PatientCreate,
    PatientInsuranceCreate,
    PatientInsuranceResponse,
    PatientInsuranceUpdate,
    PatientResponse,
    PatientUpdate,
    mask_phi,
)

router = APIRouter(tags=["patients"])


def _get_fernet() -> Optional[Fernet]:
    if settings.FERNET_KEY:
        return Fernet(settings.FERNET_KEY.encode() if isinstance(settings.FERNET_KEY, str) else settings.FERNET_KEY)
    return None


def _encrypt_ssn(ssn: Optional[str]) -> Optional[str]:
    if not ssn:
        return None
    f = _get_fernet()
    if f is None:
        return None
    return f.encrypt(ssn.encode()).decode()


def _ssn_last_four(encrypted: Optional[str]) -> Optional[str]:
    if not encrypted:
        return None
    f = _get_fernet()
    if f is None:
        return None
    try:
        plain = f.decrypt(encrypted.encode()).decode()
        digits = "".join(c for c in plain if c.isdigit())
        if len(digits) >= 4:
            return f"***-**-{digits[-4:]}"
        return "***-**-****"
    except InvalidToken:
        return None


def _build_patient_response(patient: Patient) -> PatientResponse:
    data = PatientResponse.model_validate(patient)
    data.ssn_last_four = _ssn_last_four(patient.ssn_encrypted)
    return data


async def _get_next_account_number(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    result = await db.execute(
        select(Patient.account_number)
        .where(Patient.tenant_id == tenant_id)
        .order_by(Patient.created_at.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    if last:
        try:
            num = int(last) + 1
        except (ValueError, TypeError):
            num = 100001
    else:
        num = 100001
    return str(num).zfill(7)


# ── Patients ──────────────────────────────────────────────────────────────────

@router.get("/patients", response_model=List[PatientResponse])
async def list_patients(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    practice_id: Optional[uuid.UUID] = Query(None),
    provider_id: Optional[uuid.UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    q = select(Patient).where(Patient.tenant_id == ctx.tenant_id)
    if search:
        term = f"%{search}%"
        from sqlalchemy import or_
        q = q.where(or_(
            Patient.first_name.ilike(term),
            Patient.last_name.ilike(term),
            Patient.account_number.ilike(term),
            Patient.email.ilike(term),
        ))
    if status:
        q = q.where(Patient.status == status)
    if practice_id:
        q = q.where(Patient.practice_id == practice_id)
    if provider_id:
        q = q.where(Patient.primary_care_provider_id == provider_id)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    patients = result.scalars().all()
    return [_build_patient_response(p) for p in patients]


@router.post("/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    body: PatientCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    data = body.model_dump(exclude={"ssn"})
    ssn_encrypted = _encrypt_ssn(body.ssn)
    account_number = await _get_next_account_number(db, ctx.tenant_id)
    patient = Patient(
        tenant_id=ctx.tenant_id,
        account_number=account_number,
        ssn_encrypted=ssn_encrypted,
        **data,
    )
    db.add(patient)
    await db.flush()
    return _build_patient_response(patient)


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
    return _build_patient_response(patient)


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
    data = body.model_dump(exclude_none=True, exclude={"ssn"})
    for k, v in data.items():
        setattr(patient, k, v)
    if body.ssn is not None:
        patient.ssn_encrypted = _encrypt_ssn(body.ssn)
    await db.flush()
    return _build_patient_response(patient)


# ── Insurance ─────────────────────────────────────────────────────────────────

@router.get("/patients/{patient_id}/insurance", response_model=List[PatientInsuranceResponse])
async def list_insurance(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    await _require_patient(patient_id, ctx, db)
    result = await db.execute(
        select(PatientInsurance).where(PatientInsurance.patient_id == patient_id)
    )
    return result.scalars().all()


@router.post("/patients/{patient_id}/insurance", response_model=PatientInsuranceResponse, status_code=status.HTTP_201_CREATED)
async def add_insurance(
    patient_id: uuid.UUID,
    body: PatientInsuranceCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    await _require_patient(patient_id, ctx, db)
    obj = PatientInsurance(patient_id=patient_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/patients/{patient_id}/insurance/{ins_id}", response_model=PatientInsuranceResponse)
async def update_insurance(
    patient_id: uuid.UUID,
    ins_id: uuid.UUID,
    body: PatientInsuranceUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    await _require_patient(patient_id, ctx, db)
    result = await db.execute(
        select(PatientInsurance).where(PatientInsurance.id == ins_id, PatientInsurance.patient_id == patient_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Insurance record not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/patients/{patient_id}/insurance/{ins_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_insurance(
    patient_id: uuid.UUID,
    ins_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    await _require_patient(patient_id, ctx, db)
    result = await db.execute(
        select(PatientInsurance).where(PatientInsurance.id == ins_id, PatientInsurance.patient_id == patient_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Insurance record not found")
    await db.delete(obj)


# ── Eligibility Check ─────────────────────────────────────────────────────────

@router.post("/patients/{patient_id}/eligibility-check", response_model=EligibilityCheckResponse, status_code=status.HTTP_201_CREATED)
async def run_eligibility_check(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("patients:write")),
):
    await _require_patient(patient_id, ctx, db)
    # Get active primary insurance
    result = await db.execute(
        select(PatientInsurance).where(
            PatientInsurance.patient_id == patient_id,
            PatientInsurance.priority == "primary",
            PatientInsurance.is_active == True,
        ).limit(1)
    )
    insurance = result.scalar_one_or_none()

    check = EligibilityCheck(
        patient_id=patient_id,
        patient_insurance_id=insurance.id if insurance else None,
        checked_at=datetime.now(timezone.utc),
        checked_by=current_user.id,
        status="pending",
        source="manual",
    )
    db.add(check)
    await db.flush()
    return check


# ── Stubs for visits/claims/payments/activity ─────────────────────────────────

@router.get("/patients/{patient_id}/visits")
async def get_patient_visits(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    await _require_patient(patient_id, ctx, db)
    return []


@router.get("/patients/{patient_id}/claims")
async def get_patient_claims(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    await _require_patient(patient_id, ctx, db)
    return []


@router.get("/patients/{patient_id}/payments")
async def get_patient_payments(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    await _require_patient(patient_id, ctx, db)
    return []


@router.get("/patients/{patient_id}/activity")
async def get_patient_activity(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    await _require_patient(patient_id, ctx, db)
    return []


@router.post("/patients/{patient_id}/activity", status_code=201)
async def add_patient_note(
    patient_id: uuid.UUID,
    body: dict,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("patients:write")),
):
    await _require_patient(patient_id, ctx, db)
    note_text = body.get("note", "").strip()
    if not note_text:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Note text is required")
    return {
        "id": str(uuid.uuid4()),
        "event_type": "note",
        "description": note_text,
        "user_name": f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email,
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
    }


# ── Body Map Annotations ──────────────────────────────────────────────────────

@router.get("/patients/{patient_id}/body-map-annotations", response_model=List[BodyMapAnnotationResponse])
async def list_body_map_annotations(
    patient_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:read")),
):
    await _require_patient(patient_id, ctx, db)
    result = await db.execute(
        select(BodyMapAnnotation).where(BodyMapAnnotation.patient_id == patient_id)
    )
    return result.scalars().all()


@router.post("/patients/{patient_id}/body-map-annotations", response_model=BodyMapAnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_body_map_annotation(
    patient_id: uuid.UUID,
    body: BodyMapAnnotationCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("patients:write")),
):
    await _require_patient(patient_id, ctx, db)
    obj = BodyMapAnnotation(
        patient_id=patient_id,
        created_by=current_user.id,
        **body.model_dump(),
    )
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/patients/{patient_id}/body-map-annotations/{ann_id}", response_model=BodyMapAnnotationResponse)
async def update_body_map_annotation(
    patient_id: uuid.UUID,
    ann_id: uuid.UUID,
    body: BodyMapAnnotationCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    await _require_patient(patient_id, ctx, db)
    result = await db.execute(
        select(BodyMapAnnotation).where(BodyMapAnnotation.id == ann_id, BodyMapAnnotation.patient_id == patient_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Annotation not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/patients/{patient_id}/body-map-annotations/{ann_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_body_map_annotation(
    patient_id: uuid.UUID,
    ann_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("patients:write")),
):
    await _require_patient(patient_id, ctx, db)
    result = await db.execute(
        select(BodyMapAnnotation).where(BodyMapAnnotation.id == ann_id, BodyMapAnnotation.patient_id == patient_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Annotation not found")
    await db.delete(obj)


# ── Helper ─────────────────────────────────────────────────────────────────────

async def _require_patient(patient_id: uuid.UUID, ctx: TenantContext, db: AsyncSession) -> Patient:
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.tenant_id == ctx.tenant_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient
