from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from domains.identity.models import (
    BillingCompanyUserAssignment,
    ClinicStaffAssignment,
    ManagementGroupUserAssignment,
    Tenant,
    User,
    UserRole,
)
from domains.identity.permissions import get_all_permissions_for_user

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


async def _get_user_permissions(user: User, db: AsyncSession) -> set[str]:
    """Resolve permissions for a user from their org assignments via ROLE_PERMISSIONS dict."""
    if user.is_superuser:
        return get_all_permissions_for_user(is_superuser=True)

    clinic_row = (await db.execute(
        select(ClinicStaffAssignment).where(
            ClinicStaffAssignment.user_id == user.id,
            ClinicStaffAssignment.is_active == True,
            ClinicStaffAssignment.is_primary == True,
        )
    )).scalar_one_or_none()

    bc_row = (await db.execute(
        select(BillingCompanyUserAssignment).where(
            BillingCompanyUserAssignment.user_id == user.id,
            BillingCompanyUserAssignment.is_active == True,
        )
    )).scalar_one_or_none()

    mg_row = (await db.execute(
        select(ManagementGroupUserAssignment).where(
            ManagementGroupUserAssignment.user_id == user.id,
            ManagementGroupUserAssignment.is_active == True,
        )
    )).scalar_one_or_none()

    return get_all_permissions_for_user(
        clinic_role=clinic_row.clinic_role if clinic_row else None,
        billing_role=bc_row.billing_role if bc_row else None,
        mgmt_role=mg_row.mgmt_role if mg_row else None,
    )


class TenantContext:
    """Extracted from JWT payload — ensures user belongs to tenant."""

    def __init__(self, user: User = Depends(get_current_user)):
        self.tenant_id: uuid.UUID = user.tenant_id
        self.user: User = user


def require_permission(code: str):
    """Dependency factory — checks the current user has the named permission via ROLE_PERMISSIONS dict."""

    async def _check(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if user.is_superuser:
            return user
        perms = await _get_user_permissions(user, db)
        if code not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{code}' required.",
            )
        return user

    return _check
