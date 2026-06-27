from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import settings
from database import Base, get_db
from domains.identity.models import Tenant, User
from domains.identity.router import _hash_password

# In-memory SQLite for tests (async)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def sample_tenant(db_session: AsyncSession) -> Tenant:
    tenant = Tenant(
        id=uuid.uuid4(),
        name="Test Clinic",
        slug=f"test-clinic-{uuid.uuid4().hex[:8]}",
        is_active=True,
    )
    db_session.add(tenant)
    await db_session.flush()
    return tenant


@pytest_asyncio.fixture
async def sample_user(db_session: AsyncSession, sample_tenant: Tenant) -> User:
    user = User(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        email="testuser@example.com",
        password_hash=_hash_password("password123"),
        first_name="Test",
        last_name="User",
        is_active=True,
        is_superuser=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
def access_token(sample_user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=30)
    payload = {
        "sub": str(sample_user.id),
        "tenant_id": str(sample_user.tenant_id),
        "email": sample_user.email,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession, access_token: str) -> AsyncGenerator[AsyncClient, None]:
    from main import app

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {access_token}"},
    ) as c:
        yield c

    app.dependency_overrides.clear()
