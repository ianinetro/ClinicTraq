#!/usr/bin/env python3
"""
One-time org setup script.
Creates: tenant, management group, billing company, clinic, and a billing_admin user.
Safe to re-run — skips anything that already exists.

Usage (from backend/ directory):
    python scripts/setup_org.py

Override defaults with env vars:
    SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD  — existing superuser creds
    ORG_NAME                                — management group / tenant display name
    CLINIC_NAME                             — first clinic name
    BILLING_EMAIL / BILLING_PASSWORD        — new billing_admin user to create
"""
from __future__ import annotations
import asyncio, os, sys, uuid
from passlib.context import CryptContext
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import AsyncSessionLocal
from domains.identity.models import (
    BillingCompany, BillingCompanyUserAssignment,
    Clinic, ManagementGroup, Tenant, User,
)

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

TENANT_SLUG     = os.environ.get("SEED_TENANT_SLUG", "clinictraq")
ORG_NAME        = os.environ.get("ORG_NAME", "ClinicTraq Medical Group")
CLINIC_NAME     = os.environ.get("CLINIC_NAME", "Main Street Clinic")
BILLING_EMAIL   = os.environ.get("BILLING_EMAIL", "billing@clinictraq.com")
BILLING_PASSWORD = os.environ.get("BILLING_PASSWORD", "Billing2026!")
BILLING_FIRST   = os.environ.get("BILLING_FIRST", "Billing")
BILLING_LAST    = os.environ.get("BILLING_LAST", "Admin")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        # 1. Tenant
        tenant = (await db.execute(select(Tenant).where(Tenant.slug == TENANT_SLUG))).scalar_one_or_none()
        if tenant is None:
            tenant = Tenant(id=uuid.uuid4(), name=ORG_NAME, slug=TENANT_SLUG,
                            is_active=True, plan="standard", timezone="UTC")
            db.add(tenant)
            await db.flush()
            print(f"  Created tenant: {TENANT_SLUG}")
        else:
            print(f"  Tenant exists: {TENANT_SLUG}")

        # 2. Management group
        mg = (await db.execute(
            select(ManagementGroup).where(ManagementGroup.tenant_id == tenant.id)
        )).scalar_one_or_none()
        if mg is None:
            mg = ManagementGroup(id=uuid.uuid4(), tenant_id=tenant.id, name=ORG_NAME, is_active=True)
            db.add(mg)
            await db.flush()
            print(f"  Created management group: {ORG_NAME}")
        else:
            print(f"  Management group exists: {mg.name}")

        # 3. Billing company
        bc = (await db.execute(
            select(BillingCompany).where(BillingCompany.tenant_id == tenant.id)
        )).scalar_one_or_none()
        if bc is None:
            bc = BillingCompany(
                id=uuid.uuid4(), tenant_id=tenant.id,
                management_group_id=mg.id,
                name=f"{ORG_NAME} Billing", is_active=True,
            )
            db.add(bc)
            await db.flush()
            print(f"  Created billing company: {bc.name}")
        else:
            print(f"  Billing company exists: {bc.name}")

        # 4. Clinic
        clinic = (await db.execute(
            select(Clinic).where(Clinic.tenant_id == tenant.id)
        )).scalar_one_or_none()
        if clinic is None:
            clinic = Clinic(
                id=uuid.uuid4(), tenant_id=tenant.id,
                management_group_id=mg.id,
                billing_company_id=bc.id,
                name=CLINIC_NAME, is_active=True,
                place_of_service_code="11",
            )
            db.add(clinic)
            await db.flush()
            print(f"  Created clinic: {CLINIC_NAME}")
        else:
            print(f"  Clinic exists: {clinic.name}")

        # 5. Billing admin user
        user = (await db.execute(
            select(User).where(User.tenant_id == tenant.id, User.email == BILLING_EMAIL)
        )).scalar_one_or_none()
        if user is None:
            user = User(
                id=uuid.uuid4(), tenant_id=tenant.id,
                email=BILLING_EMAIL,
                password_hash=pwd_ctx.hash(BILLING_PASSWORD),
                first_name=BILLING_FIRST, last_name=BILLING_LAST,
                is_active=True, is_superuser=False,
            )
            db.add(user)
            await db.flush()
            print(f"  Created user: {BILLING_EMAIL}")
        else:
            print(f"  User exists: {BILLING_EMAIL}")

        # 6. Assign user to billing company as billing_admin
        existing_bc_assign = (await db.execute(
            select(BillingCompanyUserAssignment).where(
                BillingCompanyUserAssignment.user_id == user.id,
                BillingCompanyUserAssignment.billing_company_id == bc.id,
            )
        )).scalar_one_or_none()
        if existing_bc_assign is None:
            db.add(BillingCompanyUserAssignment(
                id=uuid.uuid4(), tenant_id=tenant.id,
                billing_company_id=bc.id,
                user_id=user.id,
                billing_role="billing_admin",
                clinic_ids=None,  # null = access to all clinics
                is_active=True,
            ))
            print(f"  Assigned {BILLING_EMAIL} as billing_admin to billing company")
        else:
            print(f"  Billing assignment already exists")

        await db.commit()

    print()
    print("=" * 50)
    print("Setup complete. Login credentials:")
    print(f"  Email:    {BILLING_EMAIL}")
    print(f"  Password: {BILLING_PASSWORD}")
    print(f"  Role:     billing_admin (full access to all clinics)")
    print()
    print("Superuser (existing):")
    print(f"  Email:    admin@clinictraq.com")
    print(f"  Password: ClinicTraq2026!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
