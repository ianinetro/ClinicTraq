from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from domains.claims.models import Claim, ClaimLine, ClaimValidationIssue
from domains.claims.validation import ClaimValidator
from domains.identity.models import Tenant, User
from domains.master_data.models import Payer, Provider
from domains.patients.models import Patient


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def sample_patient(db_session: AsyncSession, sample_tenant: Tenant) -> Patient:
    patient = Patient(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        first_name="Jane",
        last_name="Doe",
        account_number="1000001",
        status="active",
        account_type="patient",
    )
    db_session.add(patient)
    await db_session.flush()
    return patient


@pytest_asyncio.fixture
async def sample_payer(db_session: AsyncSession, sample_tenant: Tenant) -> Payer:
    payer = Payer(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        name="Blue Cross",
        payer_id="BCBS001",
        tfl_days=365,
    )
    db_session.add(payer)
    await db_session.flush()
    return payer


@pytest_asyncio.fixture
async def sample_provider(db_session: AsyncSession, sample_tenant: Tenant) -> Provider:
    provider = Provider(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        first_name="Dr. John",
        last_name="Smith",
        npi="1234567890",
    )
    db_session.add(provider)
    await db_session.flush()
    return provider


@pytest_asyncio.fixture
async def sample_claim(
    db_session: AsyncSession,
    sample_tenant: Tenant,
    sample_patient: Patient,
    sample_payer: Payer,
    sample_provider: Provider,
) -> Claim:
    claim = Claim(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        claim_number=f"CT-{date.today().strftime('%Y%m%d')}-000001",
        patient_id=sample_patient.id,
        provider_id=sample_provider.id,
        payer_id=sample_payer.id,
        claim_type="professional",
        date_of_service=date.today() - timedelta(days=10),
        total_charge=200.0,
        status="draft",
        validation_status="pending",
        diagnoses_snapshot=[{"icd_code": "Z00.00", "sequence": 1}],
    )
    db_session.add(claim)
    await db_session.flush()

    line = ClaimLine(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        claim_id=claim.id,
        cpt_code="99213",
        modifiers=None,
        units=1,
        charge_amount=200.0,
        sequence=1,
    )
    db_session.add(line)
    await db_session.flush()
    return claim


# ── Claim creation ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_claim_has_correct_pcn(sample_claim: Claim):
    """Patient Control Number must equal claim ID."""
    assert sample_claim.patient_control_number == str(sample_claim.id)


@pytest.mark.asyncio
async def test_claim_number_format(sample_claim: Claim):
    """Claim number must follow CT-YYYYMMDD-XXXXXX format."""
    import re
    assert re.match(r"CT-\d{8}-\w+", sample_claim.claim_number)


# ── Validation: future DOS ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_future_dos_rejected(
    db_session: AsyncSession,
    sample_tenant: Tenant,
    sample_patient: Patient,
    sample_payer: Payer,
    sample_provider: Provider,
):
    claim = Claim(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        claim_number="CT-FUTURE-000001",
        patient_id=sample_patient.id,
        provider_id=sample_provider.id,
        payer_id=sample_payer.id,
        claim_type="professional",
        date_of_service=date.today() + timedelta(days=5),  # FUTURE
        total_charge=100.0,
        status="draft",
        validation_status="pending",
        diagnoses_snapshot=[{"icd_code": "Z00.00", "sequence": 1}],
    )
    db_session.add(claim)
    await db_session.flush()
    line = ClaimLine(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        claim_id=claim.id,
        cpt_code="99213",
        units=1,
        charge_amount=100.0,
        sequence=1,
    )
    db_session.add(line)
    await db_session.flush()

    # Reload with relationships
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    result = await db_session.execute(
        select(Claim).where(Claim.id == claim.id).options(
            selectinload(Claim.lines), selectinload(Claim.validation_issues)
        )
    )
    loaded_claim = result.scalar_one()

    validator = ClaimValidator(loaded_claim, db_session)
    issues = await validator.run_all()
    codes = [i["code"] for i in issues]
    assert "FUTURE_DOS" in codes, f"Expected FUTURE_DOS in issues, got: {codes}"


# ── Validation: RT/LT mismatch ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rt_left_dx_mismatch_detected(
    db_session: AsyncSession,
    sample_tenant: Tenant,
    sample_patient: Patient,
    sample_payer: Payer,
    sample_provider: Provider,
):
    """RT modifier with a left-laterality diagnosis should produce a warning."""
    claim = Claim(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        claim_number="CT-RTLT-000001",
        patient_id=sample_patient.id,
        provider_id=sample_provider.id,
        payer_id=sample_payer.id,
        claim_type="professional",
        date_of_service=date.today() - timedelta(days=5),
        total_charge=150.0,
        status="draft",
        validation_status="pending",
        # ICD code ending in '2' = left side
        diagnoses_snapshot=[{"icd_code": "M79.622", "sequence": 1}],
    )
    db_session.add(claim)
    await db_session.flush()

    line = ClaimLine(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        claim_id=claim.id,
        cpt_code="20610",
        modifiers=["RT"],  # Right side modifier but left dx
        units=1,
        charge_amount=150.0,
        sequence=1,
    )
    db_session.add(line)
    await db_session.flush()

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    result = await db_session.execute(
        select(Claim).where(Claim.id == claim.id).options(
            selectinload(Claim.lines), selectinload(Claim.validation_issues)
        )
    )
    loaded = result.scalar_one()
    validator = ClaimValidator(loaded, db_session)
    issues = await validator.run_all()
    codes = [i["code"] for i in issues]
    assert "MOD_RT_LEFT_DX" in codes, f"Expected MOD_RT_LEFT_DX, got: {codes}"


# ── Validation: modifier 59 on single line ────────────────────────────────────

@pytest.mark.asyncio
async def test_modifier_59_single_line_info(
    db_session: AsyncSession,
    sample_tenant: Tenant,
    sample_patient: Patient,
    sample_payer: Payer,
    sample_provider: Provider,
):
    claim = Claim(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        claim_number="CT-MOD59-000001",
        patient_id=sample_patient.id,
        provider_id=sample_provider.id,
        payer_id=sample_payer.id,
        date_of_service=date.today() - timedelta(days=2),
        total_charge=100.0,
        status="draft",
        validation_status="pending",
        diagnoses_snapshot=[{"icd_code": "Z00.00", "sequence": 1}],
    )
    db_session.add(claim)
    await db_session.flush()

    line = ClaimLine(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        claim_id=claim.id,
        cpt_code="99213",
        modifiers=["59"],
        units=1,
        charge_amount=100.0,
        sequence=1,
    )
    db_session.add(line)
    await db_session.flush()

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    result = await db_session.execute(
        select(Claim).where(Claim.id == claim.id).options(
            selectinload(Claim.lines), selectinload(Claim.validation_issues)
        )
    )
    loaded = result.scalar_one()
    validator = ClaimValidator(loaded, db_session)
    issues = await validator.run_all()
    codes = [i["code"] for i in issues]
    assert "MOD_59_SINGLE_LINE" in codes, f"Expected MOD_59_SINGLE_LINE, got: {codes}"


# ── Multi-tenant isolation ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tenant_isolation(
    db_session: AsyncSession,
    sample_claim: Claim,
    client: AsyncClient,
    sample_tenant: Tenant,
):
    """Tenant A cannot read Tenant B's claims."""
    # Create a second tenant
    tenant_b = Tenant(
        id=uuid.uuid4(),
        name="Other Clinic",
        slug=f"other-clinic-{uuid.uuid4().hex[:8]}",
        is_active=True,
    )
    db_session.add(tenant_b)

    patient_b = Patient(
        id=uuid.uuid4(),
        tenant_id=tenant_b.id,
        first_name="Bob",
        last_name="Other",
        account_number="9999999",
        status="active",
        account_type="patient",
    )
    db_session.add(patient_b)
    await db_session.flush()

    claim_b = Claim(
        id=uuid.uuid4(),
        tenant_id=tenant_b.id,
        claim_number="CT-TENANTB-000001",
        patient_id=patient_b.id,
        total_charge=300.0,
        status="draft",
        validation_status="pending",
    )
    db_session.add(claim_b)
    await db_session.flush()

    # Attempt to read tenant B's claim using tenant A's token
    resp = await client.get(f"/api/v1/claims/{claim_b.id}")
    assert resp.status_code == 404, (
        f"Expected 404 (tenant isolation), got {resp.status_code}: {resp.text}"
    )


# ── Claim validation via API ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_validate_claim_api(client: AsyncClient, sample_claim: Claim):
    """POST /claims/{id}/validate should return a list of issues."""
    resp = await client.post(f"/api/v1/claims/{sample_claim.id}/validate")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_valid_claim_produces_no_blocking_issues(
    db_session: AsyncSession,
    sample_claim: Claim,
):
    """A well-formed claim should have no blocking issues."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    result = await db_session.execute(
        select(Claim).where(Claim.id == sample_claim.id).options(
            selectinload(Claim.lines), selectinload(Claim.validation_issues)
        )
    )
    loaded = result.scalar_one()
    validator = ClaimValidator(loaded, db_session)
    issues = await validator.run_all()
    blocking = [i for i in issues if i["severity"] == "blocking"]
    assert len(blocking) == 0, f"Unexpected blocking issues: {blocking}"
