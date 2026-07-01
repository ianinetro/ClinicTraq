from __future__ import annotations

import re
import uuid
from datetime import date
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import User
from domains.master_data.models import (
    BillingProvider,
    CARCCode,
    ChartAccount,
    CPTCode,
    DiagnosisCode,
    Facility,
    MUELimit,
    NCCIEdit,
    Office,
    Payer,
    Practice,
    Provider,
    ProviderPayerPin,
    RARCCode,
    ReferringProvider,
)
from domains.master_data.schemas import (
    CARCCodeResponse,
    CodeSearchResult,
    CPTCodeCreate,
    CPTCodeResponse,
    CPTCodeUpdate,
    DiagnosisCodeCreate,
    DiagnosisCodeResponse,
    DiagnosisCodeUpdate,
    FacilityCreate,
    FacilityResponse,
    FacilityUpdate,
    MUELimitResponse,
    NCCIEditResponse,
    NPILookupResponse,
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
    RARCCodeResponse,
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


# ── Facility ─────────────────────────────────────────────────────────────────

@router.get("/facilities", response_model=List[FacilityResponse])
async def list_facilities(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(select(Facility).where(Facility.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/facilities", response_model=FacilityResponse, status_code=status.HTTP_201_CREATED)
async def create_facility(
    body: FacilityCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    obj = Facility(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/facilities/{facility_id}", response_model=FacilityResponse)
async def update_facility(
    facility_id: uuid.UUID,
    body: FacilityUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    result = await db.execute(
        select(Facility).where(Facility.id == facility_id, Facility.tenant_id == ctx.tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Facility not found")
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


@router.get("/npi/lookup", response_model=NPILookupResponse)
async def lookup_npi(number: str = Query(..., description="10-digit NPI")):
    """Validate NPI via Luhn then look up provider details from NPPES public registry."""
    if not _NPI_PATTERN.match(number):
        return NPILookupResponse(npi=number, valid=False, message="NPI must be exactly 10 digits")
    if not _validate_npi_luhn(number):
        return NPILookupResponse(npi=number, valid=False, message="NPI failed Luhn check")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://npiregistry.cms.hhs.gov/api/",
                params={"number": number, "version": "2.1"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return NPILookupResponse(npi=number, valid=True, message="NPI is valid (NPPES lookup unavailable)")

    results = data.get("results", [])
    if not results:
        return NPILookupResponse(npi=number, valid=False, message="NPI not found in NPPES registry")

    provider = results[0]
    basic = provider.get("basic", {})
    addresses = provider.get("addresses", [])
    taxonomies = provider.get("taxonomies", [])
    loc_addr = next((a for a in addresses if a.get("address_purpose") == "LOCATION"), addresses[0] if addresses else {})
    primary_tax = next((t for t in taxonomies if t.get("primary")), taxonomies[0] if taxonomies else {})

    return NPILookupResponse(
        npi=number,
        valid=True,
        status=provider.get("status", "ACTIVE"),
        enumeration_type=provider.get("enumeration_type"),
        first_name=basic.get("first_name"),
        last_name=basic.get("last_name"),
        organization_name=basic.get("organization_name"),
        credential=basic.get("credential"),
        taxonomy_code=primary_tax.get("code"),
        taxonomy_description=primary_tax.get("desc"),
        address=loc_addr.get("address_1"),
        city=loc_addr.get("city"),
        state=loc_addr.get("state"),
        zip_code=loc_addr.get("postal_code", "")[:5],
        phone=loc_addr.get("telephone_number"),
        message="NPI is valid and active" if provider.get("status") == "A" else "NPI found",
    )


# ── CPT / ICD-10 Search ───────────────────────────────────────────────────────

@router.get("/cpt/search", response_model=List[CodeSearchResult])
async def search_cpt(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, le=50),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    stmt = (
        select(CPTCode)
        .where(
            CPTCode.tenant_id == ctx.tenant_id,
            CPTCode.is_active.is_(True),
            or_(
                CPTCode.code.ilike(f"{q}%"),
                func.lower(CPTCode.description).contains(q.lower()),
            ),
        )
        .order_by(CPTCode.code)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [CodeSearchResult(code=r.code, description=r.description, default_fee=r.default_fee, default_units=r.default_units) for r in rows]


@router.get("/icd10/search", response_model=List[CodeSearchResult])
async def search_icd10(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, le=50),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    stmt = (
        select(DiagnosisCode)
        .where(
            DiagnosisCode.tenant_id == ctx.tenant_id,
            DiagnosisCode.is_active.is_(True),
            or_(
                DiagnosisCode.code.ilike(f"{q}%"),
                func.lower(DiagnosisCode.description).contains(q.lower()),
            ),
        )
        .order_by(DiagnosisCode.code)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [CodeSearchResult(code=r.code, description=r.description) for r in rows]


# ── NCCI / MUE ────────────────────────────────────────────────────────────────

@router.get("/ncci/ptp", response_model=Optional[NCCIEditResponse])
async def get_ncci_edit(
    col1: str = Query(..., description="Column 1 CPT code"),
    col2: str = Query(..., description="Column 2 CPT code"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    today = date.today()
    stmt = select(NCCIEdit).where(
        NCCIEdit.column1_code == col1,
        NCCIEdit.column2_code == col2,
        NCCIEdit.effective_date <= today,
        or_(NCCIEdit.deletion_date.is_(None), NCCIEdit.deletion_date >= today),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


@router.get("/mue/{cpt_code}", response_model=Optional[MUELimitResponse])
async def get_mue(
    cpt_code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    today = date.today()
    stmt = select(MUELimit).where(
        MUELimit.cpt_code == cpt_code,
        MUELimit.effective_date <= today,
        or_(MUELimit.deletion_date.is_(None), MUELimit.deletion_date >= today),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


# ── CARC / RARC ───────────────────────────────────────────────────────────────

@router.get("/carc/{code}", response_model=Optional[CARCCodeResponse])
async def get_carc(
    code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    return (await db.execute(select(CARCCode).where(CARCCode.code == code))).scalar_one_or_none()


@router.get("/rarc/{code}", response_model=Optional[RARCCodeResponse])
async def get_rarc(
    code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    return (await db.execute(select(RARCCode).where(RARCCode.code == code))).scalar_one_or_none()


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


# ── Chart of Accounts ─────────────────────────────────────────────────────────

class ChartAccountCreate(BaseModel):
    account_number: str
    name: str
    account_type: str
    parent_id: Optional[uuid.UUID] = None


class ChartAccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None


class ChartAccountResponse(BaseModel):
    id: uuid.UUID
    account_number: str
    name: str
    account_type: str
    parent_id: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}


@router.get("/chart-accounts", response_model=List[ChartAccountResponse])
async def list_chart_accounts(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:read")),
):
    result = await db.execute(
        select(ChartAccount)
        .where(ChartAccount.tenant_id == ctx.tenant_id)
        .order_by(ChartAccount.account_number)
    )
    return result.scalars().all()


@router.post("/chart-accounts", response_model=ChartAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_chart_account(
    body: ChartAccountCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    obj = ChartAccount(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/chart-accounts/{account_id}", response_model=ChartAccountResponse)
async def update_chart_account(
    account_id: uuid.UUID,
    body: ChartAccountUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    result = await db.execute(
        select(ChartAccount).where(
            ChartAccount.id == account_id, ChartAccount.tenant_id == ctx.tenant_id
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Chart account not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/chart-accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chart_account(
    account_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("master_data:write")),
):
    result = await db.execute(
        select(ChartAccount).where(
            ChartAccount.id == account_id, ChartAccount.tenant_id == ctx.tenant_id
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Chart account not found")
    obj.is_active = False
    await db.flush()
