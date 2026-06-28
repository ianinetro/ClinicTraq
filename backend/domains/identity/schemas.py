from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: str = "clinictraq"


class UserInToken(BaseModel):
    id: str
    email: str
    name: str
    role: str
    permissions: List[str] = []
    # Org context
    clinicId: Optional[str] = None
    clinicRole: Optional[str] = None
    billingCompanyId: Optional[str] = None
    billingRole: Optional[str] = None
    managementGroupId: Optional[str] = None
    mgmtRole: Optional[str] = None
    accessibleClinicIds: Optional[List[str]] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Optional[UserInToken] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# ── Tenant ────────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str
    slug: str
    plan: str = "standard"
    timezone: str = "UTC"
    npi: Optional[str] = None
    tax_id: Optional[str] = None


class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    is_active: bool
    plan: str
    timezone: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── User ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role_ids: List[uuid.UUID] = []

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role_ids: Optional[List[uuid.UUID]] = None


class UserResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    is_active: bool
    is_superuser: bool
    last_login: Optional[datetime]
    phone: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PasswordResetRequest(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ── Permission ────────────────────────────────────────────────────────────────

class PermissionResponse(BaseModel):
    id: uuid.UUID
    code: str
    description: Optional[str]
    category: str

    model_config = {"from_attributes": True}


# ── Role ──────────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permission_codes: List[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_codes: Optional[List[str]] = None


class RoleResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: Optional[str]
    is_system: bool
    permissions: List[PermissionResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}
