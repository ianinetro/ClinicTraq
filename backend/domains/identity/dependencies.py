from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings
from database import get_db
from domains.identity.models import Permission, Role, RolePermission, Tenant, User, UserRole

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

    result = await db.execute(
        select(User)
        .where(User.id == uuid.UUID(user_id))
        .options(
            selectinload(User.user_roles)
            .selectinload(UserRole.role)
            .selectinload(Role.role_permissions)
            .selectinload(RolePermission.permission)
        )
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


class TenantContext:
    """Extracted from JWT payload — ensures user belongs to tenant."""

    def __init__(self, user: User = Depends(get_current_user)):
        self.tenant_id: uuid.UUID = user.tenant_id
        self.user: User = user


def require_permission(code: str):
    """Dependency factory — checks the current user has the named permission."""

    async def _check(
        user: User = Depends(get_current_user),
    ) -> User:
        if user.is_superuser:
            return user
        # Flatten permissions across all roles
        for user_role in user.user_roles:
            for rp in user_role.role.role_permissions:
                if rp.permission.code == code:
                    return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{code}' required.",
        )

    return _check
