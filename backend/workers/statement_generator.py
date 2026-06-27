from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from worker import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="workers.statement_generator.generate_statements_all_tenants")
def generate_statements_all_tenants():
    """Nightly beat task: generate statements for all active tenants."""
    _run_async(_async_generate_all())


async def _async_generate_all():
    from database import AsyncSessionLocal
    from domains.identity.models import Tenant
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Tenant.id).where(Tenant.is_active == True))
        tenant_ids = [str(row[0]) for row in result.all()]

    for tid in tenant_ids:
        generate_statements.delay(tid)


@celery_app.task(name="workers.statement_generator.generate_statements", bind=True, max_retries=3)
def generate_statements(self, tenant_id: str):
    try:
        _run_async(_async_generate_statements(tenant_id))
    except Exception as exc:
        logger.exception("generate_statements failed for tenant %s: %s", tenant_id, exc)
        raise self.retry(exc=exc, countdown=300)


async def _async_generate_statements(tenant_id: str):
    from database import AsyncSessionLocal
    from domains.claims.models import Claim
    from domains.patients.models import Patient
    from domains.audit.models import AuditEvent
    from sqlalchemy import func, select

    tenant_uuid = uuid.UUID(tenant_id)

    async with AsyncSessionLocal() as db:
        # Find patients with outstanding balances > $0
        patients_with_balance_result = await db.execute(
            select(
                Claim.patient_id,
                func.sum(Claim.balance).label("total_balance"),
            )
            .where(
                Claim.tenant_id == tenant_uuid,
                Claim.balance > 0.01,
                Claim.status.notin_(["draft", "cancelled"]),
            )
            .group_by(Claim.patient_id)
            .having(func.sum(Claim.balance) > 0.01)
            .limit(5000)
        )
        patients_with_balance = patients_with_balance_result.all()

        statements_generated = 0
        for row in patients_with_balance:
            patient_id = row.patient_id
            total_balance = float(row.total_balance)

            # Load patient for statement data
            patient_result = await db.execute(
                select(Patient).where(Patient.id == patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            if not patient:
                continue

            # Check no_statement flag
            if getattr(patient, "no_statement_flag", False):
                continue

            # Load open claims for this patient
            claims_result = await db.execute(
                select(Claim).where(
                    Claim.tenant_id == tenant_uuid,
                    Claim.patient_id == patient_id,
                    Claim.balance > 0.01,
                ).limit(50)
            )
            open_claims = claims_result.scalars().all()

            # Build statement data structure
            statement_data = {
                "patient_id": str(patient_id),
                "patient_name": f"{patient.first_name} {patient.last_name}",
                "total_balance": total_balance,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "claims": [
                    {
                        "claim_number": c.claim_number,
                        "date_of_service": str(c.date_of_service),
                        "total_charge": float(c.total_charge),
                        "total_paid": float(c.total_paid),
                        "balance": float(c.balance),
                    }
                    for c in open_claims
                ],
            }

            # In production: render PDF via WeasyPrint, store in S3/Azure Blob, queue mailing
            # For now we log the statement generation to audit
            audit_event = AuditEvent(
                tenant_id=tenant_uuid,
                user_id=None,
                action="statement_generated",
                resource_type="patient",
                resource_id=str(patient_id),
                new_values={"total_balance": total_balance, "claim_count": len(open_claims)},
                phi_accessed=True,
            )
            db.add(audit_event)
            statements_generated += 1

        await db.commit()
        logger.info(
            "Statement generation done for tenant %s: %d statements generated",
            tenant_id,
            statements_generated,
        )
