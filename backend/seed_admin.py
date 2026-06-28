"""
One-time seed: creates the default tenant and superuser admin if they don't exist.
Run inside the container before gunicorn starts.
"""
import asyncio
import os
import sys

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TENANT_SLUG = os.environ.get("SEED_TENANT_SLUG", "clinictraq")
TENANT_NAME = os.environ.get("SEED_TENANT_NAME", "ClinicTraq")
ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@clinictraq.com")
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "ClinicTraq2026!")
ADMIN_FIRST = os.environ.get("SEED_ADMIN_FIRST", "Admin")
ADMIN_LAST = os.environ.get("SEED_ADMIN_LAST", "User")


async def seed():
    # import models so metadata is populated
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    from domains.identity.models import Tenant, User

    async with SessionLocal() as session:
        # Check if tenant exists
        result = await session.execute(select(Tenant).where(Tenant.slug == TENANT_SLUG))
        tenant = result.scalar_one_or_none()

        if tenant is None:
            import uuid
            tenant = Tenant(
                id=uuid.uuid4(),
                name=TENANT_NAME,
                slug=TENANT_SLUG,
                is_active=True,
                plan="standard",
                timezone="UTC",
            )
            session.add(tenant)
            await session.flush()
            print(f"Created tenant: {TENANT_NAME} (slug={TENANT_SLUG})", flush=True)
        else:
            print(f"Tenant already exists: {TENANT_SLUG}", flush=True)

        # Check if admin user exists
        result = await session.execute(
            select(User).where(User.tenant_id == tenant.id, User.email == ADMIN_EMAIL)
        )
        user = result.scalar_one_or_none()

        if user is None:
            import uuid
            user = User(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                email=ADMIN_EMAIL,
                password_hash=pwd_context.hash(ADMIN_PASSWORD),
                first_name=ADMIN_FIRST,
                last_name=ADMIN_LAST,
                is_active=True,
                is_superuser=True,
            )
            session.add(user)
            print(f"Created admin user: {ADMIN_EMAIL}", flush=True)
        else:
            print(f"Admin user already exists: {ADMIN_EMAIL}", flush=True)

        await session.commit()

    await engine.dispose()
    print("Seed complete.", flush=True)


asyncio.run(seed())
