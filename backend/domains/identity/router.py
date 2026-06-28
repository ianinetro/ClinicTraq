from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings
from database import get_db
from domains.identity.dependencies import TenantContext, get_current_user, require_permission
from domains.identity.models import (
    BillingCompanyUserAssignment,
    ClinicStaffAssignment,
    ManagementGroupUserAssignment,
    Permission,
    RefreshToken,
    Role,
    RolePermission,
    Tenant,
    User,
    UserRole,
)
from domains.identity.permissions import get_all_permissions_for_user
from domains.identity.schemas import (
    LoginRequest,
    LogoutRequest,
    PasswordResetRequest,
    RefreshRequest,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)

router = APIRouter(tags=["identity"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "email": user.email,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ── Auth endpoints ─────────────────────────────────────────────────────────────

@router.post("/auth/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Resolve tenant
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.slug == body.tenant_slug, Tenant.is_active == True)
    )
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    # Resolve user
    user_result = await db.execute(
        select(User)
        .where(User.tenant_id == tenant.id, User.email == body.email, User.is_active == True)
        .options(
            selectinload(User.user_roles)
            .selectinload(UserRole.role)
            .selectinload(Role.role_permissions)
            .selectinload(RolePermission.permission)
        )
    )
    user = user_result.scalar_one_or_none()
    if user is None or not _verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Issue tokens
    access_token = _create_access_token(user)
    raw_refresh = secrets.token_urlsafe(64)
    refresh_hash = _hash_token(raw_refresh)

    rt = RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    db.add(rt)

    user.last_login = datetime.now(timezone.utc)
    await db.flush()

    # Resolve org context for this user
    clinic_assignment = (await db.execute(
        select(ClinicStaffAssignment).where(
            ClinicStaffAssignment.user_id == user.id,
            ClinicStaffAssignment.is_active == True,
            ClinicStaffAssignment.is_primary == True,
        )
    )).scalar_one_or_none()

    bc_assignment = (await db.execute(
        select(BillingCompanyUserAssignment).where(
            BillingCompanyUserAssignment.user_id == user.id,
            BillingCompanyUserAssignment.is_active == True,
        )
    )).scalar_one_or_none()

    mg_assignment = (await db.execute(
        select(ManagementGroupUserAssignment).where(
            ManagementGroupUserAssignment.user_id == user.id,
            ManagementGroupUserAssignment.is_active == True,
        )
    )).scalar_one_or_none()

    clinic_role = clinic_assignment.clinic_role if clinic_assignment else None
    billing_role = bc_assignment.billing_role if bc_assignment else None
    mgmt_role = mg_assignment.mgmt_role if mg_assignment else None

    role_name = "superuser" if user.is_superuser else (clinic_role or billing_role or mgmt_role or "user")
    permissions = list(get_all_permissions_for_user(
        clinic_role=clinic_role,
        billing_role=billing_role,
        mgmt_role=mgmt_role,
        is_superuser=user.is_superuser,
    ))

    # Accessible clinic IDs for billing users
    accessible_clinic_ids: list[str] | None = None
    if bc_assignment:
        if bc_assignment.clinic_ids:
            accessible_clinic_ids = [str(c) for c in bc_assignment.clinic_ids]
        # else null = all clinics in the company

    from domains.identity.schemas import UserInToken
    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserInToken(
            id=str(user.id),
            email=user.email,
            name=f"{user.first_name} {user.last_name}",
            role=role_name,
            permissions=permissions,
            clinicId=str(clinic_assignment.clinic_id) if clinic_assignment else None,
            clinicRole=clinic_role,
            billingCompanyId=str(bc_assignment.billing_company_id) if bc_assignment else None,
            billingRole=billing_role,
            managementGroupId=str(mg_assignment.management_group_id) if mg_assignment else None,
            mgmtRole=mgmt_role,
            accessibleClinicIds=accessible_clinic_ids,
        ),
    )


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token_hash = _hash_token(body.refresh_token)
    rt_result = await db.execute(
        select(RefreshToken)
        .where(RefreshToken.token_hash == token_hash, RefreshToken.revoked == False)
        .options(selectinload(RefreshToken.user))
    )
    rt = rt_result.scalar_one_or_none()
    if rt is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if rt.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    # Revoke old token
    rt.revoked = True
    rt.revoked_at = datetime.now(timezone.utc)

    user = rt.user
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User disabled")

    # Issue new tokens
    access_token = _create_access_token(user)
    raw_refresh = secrets.token_urlsafe(64)
    new_rt = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    db.add(new_rt)
    await db.flush()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: LogoutRequest,
    db: AsyncSession = Depends(get_db),
):
    token_hash = _hash_token(body.refresh_token)
    rt_result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    rt = rt_result.scalar_one_or_none()
    if rt:
        rt.revoked = True
        rt.revoked_at = datetime.now(timezone.utc)
        await db.flush()


@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# ── User endpoints ────────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("users:read")),
):
    result = await db.execute(select(User).where(User.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("users:write")),
):
    existing = await db.execute(
        select(User).where(User.tenant_id == ctx.tenant_id, User.email == body.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    user = User(
        tenant_id=ctx.tenant_id,
        email=body.email,
        password_hash=_hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
    )
    db.add(user)
    await db.flush()

    for role_id in body.role_ids:
        db.add(UserRole(user_id=user.id, role_id=role_id))
    await db.flush()

    return user


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("users:read")),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == ctx.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("users:write")),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == ctx.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    for field, value in body.model_dump(exclude_none=True, exclude={"role_ids"}).items():
        setattr(user, field, value)

    if body.role_ids is not None:
        await db.execute(
            select(UserRole).where(UserRole.user_id == user_id)
        )
        # Delete existing roles and re-assign
        existing_roles_result = await db.execute(
            select(UserRole).where(UserRole.user_id == user_id)
        )
        for ur in existing_roles_result.scalars().all():
            await db.delete(ur)
        await db.flush()
        for role_id in body.role_ids:
            db.add(UserRole(user_id=user_id, role_id=role_id))

    await db.flush()
    return user


@router.post("/users/{user_id}/disable", status_code=status.HTTP_204_NO_CONTENT)
async def disable_user(
    user_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("users:write")),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == ctx.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    await db.flush()


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    user_id: uuid.UUID,
    body: PasswordResetRequest,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("users:write")),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == ctx.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.password_hash = _hash_password(body.new_password)
    await db.flush()


# ── Role endpoints ────────────────────────────────────────────────────────────

@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("roles:read")),
):
    result = await db.execute(
        select(Role)
        .where(Role.tenant_id == ctx.tenant_id)
        .options(
            selectinload(Role.role_permissions).selectinload(RolePermission.permission)
        )
    )
    return result.scalars().all()


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    body: RoleCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("roles:write")),
):
    role = Role(tenant_id=ctx.tenant_id, name=body.name, description=body.description)
    db.add(role)
    await db.flush()

    for code in body.permission_codes:
        perm_result = await db.execute(select(Permission).where(Permission.code == code))
        perm = perm_result.scalar_one_or_none()
        if perm:
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))
    await db.flush()
    await db.refresh(role, ["role_permissions"])
    return role


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("roles:read")),
):
    result = await db.execute(
        select(Role)
        .where(Role.id == role_id, Role.tenant_id == ctx.tenant_id)
        .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role


@router.patch("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: uuid.UUID,
    body: RoleUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("roles:write")),
):
    result = await db.execute(
        select(Role)
        .where(Role.id == role_id, Role.tenant_id == ctx.tenant_id)
        .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify system roles")

    if body.name is not None:
        role.name = body.name
    if body.description is not None:
        role.description = body.description

    if body.permission_codes is not None:
        for rp in role.role_permissions:
            await db.delete(rp)
        await db.flush()
        for code in body.permission_codes:
            perm_result = await db.execute(select(Permission).where(Permission.code == code))
            perm = perm_result.scalar_one_or_none()
            if perm:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))
        await db.flush()

    return role


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("roles:write")),
):
    result = await db.execute(
        select(Role).where(Role.id == role_id, Role.tenant_id == ctx.tenant_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete system roles")
    await db.delete(role)
    await db.flush()
