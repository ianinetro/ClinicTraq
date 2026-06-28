"""
Router for managing multi-layer organizational hierarchy:
  ManagementGroup → BillingCompany → Clinic → ClinicStaffAssignment
  + BillingCompanyUserAssignment + ManagementGroupUserAssignment
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import (
    BillingCompany,
    BillingCompanyUserAssignment,
    Clinic,
    ClinicStaffAssignment,
    ManagementGroup,
    ManagementGroupUserAssignment,
)
from domains.identity.permissions import PERM_ORG_MANAGE_CLINICS, PERM_ORG_VIEW_CLINICS

router = APIRouter(prefix="/org", tags=["Organization"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ManagementGroupOut(BaseModel):
    id: uuid.UUID
    name: str
    contact_email: Optional[str]
    contact_phone: Optional[str]
    address: Optional[str]
    is_active: bool
    model_config = {"from_attributes": True}


class ManagementGroupCreate(BaseModel):
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None


class BillingCompanyOut(BaseModel):
    id: uuid.UUID
    name: str
    management_group_id: Optional[uuid.UUID]
    npi: Optional[str]
    tax_id: Optional[str]
    contact_email: Optional[str]
    is_active: bool
    model_config = {"from_attributes": True}


class BillingCompanyCreate(BaseModel):
    name: str
    management_group_id: Optional[uuid.UUID] = None
    npi: Optional[str] = None
    tax_id: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None


class ClinicOut(BaseModel):
    id: uuid.UUID
    name: str
    management_group_id: Optional[uuid.UUID]
    billing_company_id: Optional[uuid.UUID]
    npi: Optional[str]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip_code: Optional[str]
    phone: Optional[str]
    place_of_service_code: str
    is_active: bool
    model_config = {"from_attributes": True}


class ClinicCreate(BaseModel):
    name: str
    management_group_id: Optional[uuid.UUID] = None
    billing_company_id: Optional[uuid.UUID] = None
    npi: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    place_of_service_code: str = "11"


class StaffAssignmentOut(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    user_id: uuid.UUID
    clinic_role: str
    is_primary: bool
    is_active: bool
    model_config = {"from_attributes": True}


class StaffAssignmentCreate(BaseModel):
    clinic_id: uuid.UUID
    user_id: uuid.UUID
    clinic_role: str
    is_primary: bool = True


class BillingUserAssignmentOut(BaseModel):
    id: uuid.UUID
    billing_company_id: uuid.UUID
    user_id: uuid.UUID
    billing_role: str
    clinic_ids: Optional[list] = None
    is_active: bool
    model_config = {"from_attributes": True}


class BillingUserAssignmentCreate(BaseModel):
    billing_company_id: uuid.UUID
    user_id: uuid.UUID
    billing_role: str
    clinic_ids: Optional[list[uuid.UUID]] = None


class MgmtUserAssignmentOut(BaseModel):
    id: uuid.UUID
    management_group_id: uuid.UUID
    user_id: uuid.UUID
    mgmt_role: str
    is_active: bool
    model_config = {"from_attributes": True}


class MgmtUserAssignmentCreate(BaseModel):
    management_group_id: uuid.UUID
    user_id: uuid.UUID
    mgmt_role: str


# ── Management Groups ─────────────────────────────────────────────────────────

@router.get("/management-groups", response_model=List[ManagementGroupOut])
async def list_management_groups(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ManagementGroup).where(ManagementGroup.tenant_id == ctx.tenant_id)
    )
    return result.scalars().all()


@router.post("/management-groups", response_model=ManagementGroupOut, status_code=201)
async def create_management_group(
    body: ManagementGroupCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("org:manage_management_groups")),
):
    mg = ManagementGroup(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(mg)
    await db.commit()
    await db.refresh(mg)
    return mg


@router.patch("/management-groups/{mg_id}", response_model=ManagementGroupOut)
async def update_management_group(
    mg_id: uuid.UUID,
    body: ManagementGroupCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("org:manage_management_groups")),
):
    result = await db.execute(
        select(ManagementGroup).where(ManagementGroup.id == mg_id, ManagementGroup.tenant_id == ctx.tenant_id)
    )
    mg = result.scalar_one_or_none()
    if not mg:
        raise HTTPException(status_code=404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(mg, k, v)
    await db.commit()
    await db.refresh(mg)
    return mg


# ── Billing Companies ─────────────────────────────────────────────────────────

@router.get("/billing-companies", response_model=List[BillingCompanyOut])
async def list_billing_companies(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BillingCompany).where(BillingCompany.tenant_id == ctx.tenant_id)
    )
    return result.scalars().all()


@router.post("/billing-companies", response_model=BillingCompanyOut, status_code=201)
async def create_billing_company(
    body: BillingCompanyCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("org:manage_billing_companies")),
):
    bc = BillingCompany(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(bc)
    await db.commit()
    await db.refresh(bc)
    return bc


@router.patch("/billing-companies/{bc_id}", response_model=BillingCompanyOut)
async def update_billing_company(
    bc_id: uuid.UUID,
    body: BillingCompanyCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("org:manage_billing_companies")),
):
    result = await db.execute(
        select(BillingCompany).where(BillingCompany.id == bc_id, BillingCompany.tenant_id == ctx.tenant_id)
    )
    bc = result.scalar_one_or_none()
    if not bc:
        raise HTTPException(status_code=404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(bc, k, v)
    await db.commit()
    await db.refresh(bc)
    return bc


# ── Clinics ───────────────────────────────────────────────────────────────────

@router.get("/clinics", response_model=List[ClinicOut])
async def list_clinics(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Clinic).where(Clinic.tenant_id == ctx.tenant_id)
    )
    return result.scalars().all()


@router.post("/clinics", response_model=ClinicOut, status_code=201)
async def create_clinic(
    body: ClinicCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("org:manage_clinics")),
):
    clinic = Clinic(tenant_id=ctx.tenant_id, **body.model_dump())
    db.add(clinic)
    await db.commit()
    await db.refresh(clinic)
    return clinic


@router.patch("/clinics/{clinic_id}", response_model=ClinicOut)
async def update_clinic(
    clinic_id: uuid.UUID,
    body: ClinicCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("org:manage_clinics")),
):
    result = await db.execute(
        select(Clinic).where(Clinic.id == clinic_id, Clinic.tenant_id == ctx.tenant_id)
    )
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(clinic, k, v)
    await db.commit()
    await db.refresh(clinic)
    return clinic


# ── Clinic Staff Assignments ──────────────────────────────────────────────────

@router.get("/clinics/{clinic_id}/staff", response_model=List[StaffAssignmentOut])
async def list_clinic_staff(
    clinic_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClinicStaffAssignment).where(
            ClinicStaffAssignment.clinic_id == clinic_id,
            ClinicStaffAssignment.tenant_id == ctx.tenant_id,
        )
    )
    return result.scalars().all()


@router.post("/clinics/{clinic_id}/staff", response_model=StaffAssignmentOut, status_code=201)
async def assign_clinic_staff(
    clinic_id: uuid.UUID,
    body: StaffAssignmentCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("settings:manage_users")),
):
    assignment = ClinicStaffAssignment(
        tenant_id=ctx.tenant_id,
        clinic_id=clinic_id,
        user_id=body.user_id,
        clinic_role=body.clinic_role,
        is_primary=body.is_primary,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment


@router.patch("/staff-assignments/{assignment_id}", response_model=StaffAssignmentOut)
async def update_staff_assignment(
    assignment_id: uuid.UUID,
    body: dict,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("settings:manage_users")),
):
    result = await db.execute(
        select(ClinicStaffAssignment).where(
            ClinicStaffAssignment.id == assignment_id,
            ClinicStaffAssignment.tenant_id == ctx.tenant_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404)
    for k, v in body.items():
        if hasattr(assignment, k):
            setattr(assignment, k, v)
    await db.commit()
    await db.refresh(assignment)
    return assignment


# ── Billing Company User Assignments ─────────────────────────────────────────

@router.get("/billing-companies/{bc_id}/users", response_model=List[BillingUserAssignmentOut])
async def list_billing_users(
    bc_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BillingCompanyUserAssignment).where(
            BillingCompanyUserAssignment.billing_company_id == bc_id,
            BillingCompanyUserAssignment.tenant_id == ctx.tenant_id,
        )
    )
    return result.scalars().all()


@router.post("/billing-companies/{bc_id}/users", response_model=BillingUserAssignmentOut, status_code=201)
async def assign_billing_user(
    bc_id: uuid.UUID,
    body: BillingUserAssignmentCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("org:manage_billing_companies")),
):
    assignment = BillingCompanyUserAssignment(
        tenant_id=ctx.tenant_id,
        billing_company_id=bc_id,
        user_id=body.user_id,
        billing_role=body.billing_role,
        clinic_ids=[str(c) for c in body.clinic_ids] if body.clinic_ids else None,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment


# ── Management Group User Assignments ────────────────────────────────────────

@router.get("/management-groups/{mg_id}/users", response_model=List[MgmtUserAssignmentOut])
async def list_mgmt_users(
    mg_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ManagementGroupUserAssignment).where(
            ManagementGroupUserAssignment.management_group_id == mg_id,
            ManagementGroupUserAssignment.tenant_id == ctx.tenant_id,
        )
    )
    return result.scalars().all()


@router.post("/management-groups/{mg_id}/users", response_model=MgmtUserAssignmentOut, status_code=201)
async def assign_mgmt_user(
    mg_id: uuid.UUID,
    body: MgmtUserAssignmentCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("org:manage_management_groups")),
):
    assignment = ManagementGroupUserAssignment(
        tenant_id=ctx.tenant_id,
        management_group_id=mg_id,
        user_id=body.user_id,
        mgmt_role=body.mgmt_role,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment
