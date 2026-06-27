from __future__ import annotations

import re
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import User
from domains.master_data.models import (
    BillingProvider,
    CPTCode,
    DiagnosisCode,
    Facility,
    Office,
    Payer,
    Practice,
    Provider,
    ProviderPayerPin,
    ReferringProvider,
)
from domains.master_data.schemas import (
    CPTCodeCreate,
    CPTCodeResponse,
    CPTCodeUpdate,
    DiagnosisCodeCreate,
    DiagnosisCodeResponse,
    DiagnosisCodeUpdate,
    NPIValidationResponse,
    OfficeCreate,
    OfficeResponse,
    OfficeUpdate,
    PayerCreate,
    PayerResponse,
    PayerUpdate,
    PracticeCreate,
    PracticeResponse,
    PracticeUpdate,
    ProviderCreate,
    ProviderPayerPinCreate,
    ProviderPayerPinResponse,
    ProviderResponse,
    ProviderUpdate,
)

router = APIRouter(tags=["master_data"])

_NPI_PATTERN = re.compile(r"^\d{10}$")


def _validate_npi_luhn(npi: str) -> bool:
    """Validate NPI using the Luhn algorithm (prefix 80840)."""
    digits = "80840" + npi
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


# ── Practice ──────────────────────────────────────────────────────────────────

@router.get("/practices", response_model=List[PracticeResponse])
async def list_practices(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(select(Practice).where(Practice.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/practices", response_model=PracticeResponse, status_code=status.HTTP_201_CREATED)
async def create_practice(
    body: PracticeCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    practice = Practice(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(practice)
    await db.flush()
    return practice


@router.get("/practices/{practice_id}", response_model=PracticeResponse)
async def get_practice(
    practice_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(
        select(Practice).where(Practice.id == practice_id, Practice.tenant_id == ctx.tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Practice not found")
    return obj


@router.patch("/practices/{practice_id}", response_model=PracticeResponse)
async def update_practice(
    practice_id: uuid.UUID,
    body: PracticeUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    result = await db.execute(
        select(Practice).where(Practice.id == practice_id, Practice.tenant_id == ctx.tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Practice not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


# ── Office ────────────────────────────────────────────────────────────────────

@router.get("/offices", response_model=List[OfficeResponse])
async def list_offices(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(select(Office).where(Office.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/offices", response_model=OfficeResponse, status_code=status.HTTP_201_CREATED)
async def create_office(
    body: OfficeCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    obj = Office(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/offices/{office_id}", response_model=OfficeResponse)
async def update_office(
    office_id: uuid.UUID,
    body: OfficeUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    result = await db.execute(
        select(Office).where(Office.id == office_id, Office.tenant_id == ctx.tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Office not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


# ── Provider ──────────────────────────────────────────────────────────────────

@router.get("/providers", response_model=List[ProviderResponse])
async def list_providers(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(select(Provider).where(Provider.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/providers", response_model=ProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    body: ProviderCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    obj = Provider(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.get("/providers/{provider_id}", response_model=ProviderResponse)
async def get_provider(
    provider_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(
        select(Provider).where(Provider.id == provider_id, Provider.tenant_id == ctx.tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Provider not found")
    return obj


@router.patch("/providers/{provider_id}", response_model=ProviderResponse)
async def update_provider(
    provider_id: uuid.UUID,
    body: ProviderUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    result = await db.execute(
        select(Provider).where(Provider.id == provider_id, Provider.tenant_id == ctx.tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Provider not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.get("/providers/validate-npi/{npi}", response_model=NPIValidationResponse)
async def validate_npi(npi: str):
    if not _NPI_PATTERN.match(npi):
        return NPIValidationResponse(npi=npi, valid=False, message="NPI must be exactly 10 digits")
    if not _validate_npi_luhn(npi):
        return NPIValidationResponse(npi=npi, valid=False, message="NPI failed Luhn check")
    return NPIValidationResponse(npi=npi, valid=True, message="NPI is valid")


# ── Payer ─────────────────────────────────────────────────────────────────────

@router.get("/payers", response_model=List[PayerResponse])
async def list_payers(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(select(Payer).where(Payer.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/payers", response_model=PayerResponse, status_code=status.HTTP_201_CREATED)
async def create_payer(
    body: PayerCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    obj = Payer(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.get("/payers/{payer_id}", response_model=PayerResponse)
async def get_payer(
    payer_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(
        select(Payer).where(Payer.id == payer_id, Payer.tenant_id == ctx.tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Payer not found")
    return obj


@router.patch("/payers/{payer_id}", response_model=PayerResponse)
async def update_payer(
    payer_id: uuid.UUID,
    body: PayerUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    result = await db.execute(
        select(Payer).where(Payer.id == payer_id, Payer.tenant_id == ctx.tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Payer not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


# ── CPT Codes ─────────────────────────────────────────────────────────────────

@router.get("/cpt-codes", response_model=List[CPTCodeResponse])
async def list_cpt_codes(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(select(CPTCode).where(CPTCode.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/cpt-codes", response_model=CPTCodeResponse, status_code=status.HTTP_201_CREATED)
async def create_cpt_code(
    body: CPTCodeCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    obj = CPTCode(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/cpt-codes/{code_id}", response_model=CPTCodeResponse)
async def update_cpt_code(
    code_id: uuid.UUID,
    body: CPTCodeUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    result = await db.execute(
        select(CPTCode).where(CPTCode.id == code_id, CPTCode.tenant_id == ctx.tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="CPT code not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


# ── Diagnosis Codes ───────────────────────────────────────────────────────────

@router.get("/diagnosis-codes", response_model=List[DiagnosisCodeResponse])
async def list_diagnosis_codes(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(select(DiagnosisCode).where(DiagnosisCode.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/diagnosis-codes", response_model=DiagnosisCodeResponse, status_code=status.HTTP_201_CREATED)
async def create_diagnosis_code(
    body: DiagnosisCodeCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    obj = DiagnosisCode(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/diagnosis-codes/{code_id}", response_model=DiagnosisCodeResponse)
async def update_diagnosis_code(
    code_id: uuid.UUID,
    body: DiagnosisCodeUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    result = await db.execute(
        select(DiagnosisCode).where(DiagnosisCode.id == code_id, DiagnosisCode.tenant_id == ctx.tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Diagnosis code not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


# ── Provider Payer Pins ───────────────────────────────────────────────────────

@router.get("/provider-payer-pins", response_model=List[ProviderPayerPinResponse])
async def list_pins(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(select(ProviderPayerPin).where(ProviderPayerPin.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/provider-payer-pins", response_model=ProviderPayerPinResponse, status_code=status.HTTP_201_CREATED)
async def create_pin(
    body: ProviderPayerPinCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    obj = ProviderPayerPin(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return obj
