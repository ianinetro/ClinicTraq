from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from worker import celery_app

logger = logging.getLogger(__name__)

STALE_CLAIM_DAYS = 30
UNAPPLIED_PAYMENT_DAYS = 15


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="workers.reconciler.run_reconciler_all_tenants")
def run_reconciler_all_tenants():
    """Daily beat task: run reconciler for all active tenants."""
    _run_async(_async_reconcile_all())


async def _async_reconcile_all():
    from database import AsyncSessionLocal
    from domains.identity.models import Tenant
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Tenant.id).where(Tenant.is_active == True))
        tenant_ids = [str(row[0]) for row in result.all()]

    for tid in tenant_ids:
        run_reconciler.delay(tid)


@celery_app.task(name="workers.reconciler.run_reconciler", bind=True, max_retries=3)
def run_reconciler(self, tenant_id: str):
    try:
        _run_async(_async_run_reconciler(tenant_id))
    except Exception as exc:
        logger.exception("reconciler failed for tenant %s: %s", tenant_id, exc)
        raise self.retry(exc=exc, countdown=300)


async def _async_run_reconciler(tenant_id: str):
    from database import AsyncSessionLocal
    from domains.claims.models import Claim
    from domains.payments.models import Payment
    from domains.visits.models import Visit
    from domains.work_queue.models import (
        WorkItem,
        WORK_ITEM_STALE_CLAIM,
        WORK_ITEM_UNAPPLIED_PAYMENT,
        WORK_ITEM_SECONDARY_BILLING,
        WORK_ITEM_SUPERBILL_MISMATCH,
        WORK_ITEM_PRIORITY_HIGH,
        WORK_ITEM_PRIORITY_NORMAL,
    )
    from sqlalchemy import func, select

    tenant_uuid = uuid.UUID(tenant_id)
    now = datetime.now(timezone.utc)
    stale_cutoff = now - timedelta(days=STALE_CLAIM_DAYS)
    unapplied_cutoff = now - timedelta(days=UNAPPLIED_PAYMENT_DAYS)

    async with AsyncSessionLocal() as db:
        # 1. Stale claims: submitted >30 days ago with no response
        stale_result = await db.execute(
            select(Claim).where(
                Claim.tenant_id == tenant_uuid,
                Claim.status == "submitted",
                Claim.last_submitted_at < stale_cutoff,
            ).limit(500)
        )
        stale_claims = stale_result.scalars().all()
        for claim in stale_claims:
            existing = await db.execute(
                select(WorkItem).where(
                    WorkItem.tenant_id == tenant_uuid,
                    WorkItem.claim_id == claim.id,
                    WorkItem.item_type == WORK_ITEM_STALE_CLAIM,
                    WorkItem.status.in_(["open", "in_progress"]),
                )
            )
            if not existing.scalar_one_or_none():
                db.add(WorkItem(
                    tenant_id=tenant_uuid,
                    item_type=WORK_ITEM_STALE_CLAIM,
                    title=f"Claim {claim.claim_number} has no response in {STALE_CLAIM_DAYS}+ days",
                    description=f"Claim submitted on {claim.last_submitted_at} with no payer response.",
                    priority=WORK_ITEM_PRIORITY_HIGH,
                    patient_id=claim.patient_id,
                    claim_id=claim.id,
                ))

        # 2. Unapplied payments >15 days
        unapplied_result = await db.execute(
            select(Payment).where(
                Payment.tenant_id == tenant_uuid,
                Payment.unapplied_amount > 0.01,
                Payment.is_reversed == False,
                Payment.created_at < unapplied_cutoff,
            ).limit(500)
        )
        unapplied_payments = unapplied_result.scalars().all()
        for payment in unapplied_payments:
            existing = await db.execute(
                select(WorkItem).where(
                    WorkItem.tenant_id == tenant_uuid,
                    WorkItem.payment_id == payment.id,
                    WorkItem.item_type == "unapplied_payment",
                    WorkItem.status.in_(["open", "in_progress"]),
                )
            )
            if not existing.scalar_one_or_none():
                db.add(WorkItem(
                    tenant_id=tenant_uuid,
                    item_type="unapplied_payment",
                    title=f"Payment {payment.id} has ${payment.unapplied_amount} unapplied for {UNAPPLIED_PAYMENT_DAYS}+ days",
                    priority=WORK_ITEM_PRIORITY_NORMAL,
                    patient_id=payment.patient_id,
                    payment_id=payment.id,
                ))

        # 3. Claims with paid primary needing secondary billing
        secondary_result = await db.execute(
            select(Claim).where(
                Claim.tenant_id == tenant_uuid,
                Claim.status == "paid",
                Claim.is_secondary == False,
                Claim.balance > 0.01,
            ).limit(500)
        )
        secondary_needed = secondary_result.scalars().all()
        for claim in secondary_needed:
            from domains.patients.models import PatientInsurance
            ins_result = await db.execute(
                select(PatientInsurance).where(
                    PatientInsurance.patient_id == claim.patient_id,
                    PatientInsurance.priority == 2,
                    PatientInsurance.is_active == True,
                ).limit(1)
            )
            if ins_result.scalar_one_or_none():
                existing = await db.execute(
                    select(WorkItem).where(
                        WorkItem.tenant_id == tenant_uuid,
                        WorkItem.claim_id == claim.id,
                        WorkItem.item_type == WORK_ITEM_SECONDARY_BILLING,
                        WorkItem.status.in_(["open", "in_progress"]),
                    )
                )
                if not existing.scalar_one_or_none():
                    db.add(WorkItem(
                        tenant_id=tenant_uuid,
                        item_type=WORK_ITEM_SECONDARY_BILLING,
                        title=f"Claim {claim.claim_number}: secondary billing needed (balance ${claim.balance:.2f})",
                        priority=WORK_ITEM_PRIORITY_NORMAL,
                        patient_id=claim.patient_id,
                        claim_id=claim.id,
                    ))

        # 4. Superbill count vs visit count mismatch (simple heuristic)
        visit_count_result = await db.execute(
            select(func.count(Visit.id)).where(
                Visit.tenant_id == tenant_uuid,
                Visit.status == "open",
                Visit.created_at < now - timedelta(days=3),
            )
        )
        open_visit_count = visit_count_result.scalar() or 0
        if open_visit_count > 0:
            db.add(WorkItem(
                tenant_id=tenant_uuid,
                item_type=WORK_ITEM_SUPERBILL_MISMATCH,
                title=f"{open_visit_count} visit(s) have been open >3 days without billing",
                description="Superbill may not have been generated for these visits.",
                priority=WORK_ITEM_PRIORITY_NORMAL,
            ))

        await db.commit()
        logger.info(
            "Reconciler done for tenant %s: %d stale, %d unapplied, %d secondary, %d open visits",
            tenant_id,
            len(stale_claims),
            len(unapplied_payments),
            len(secondary_needed),
            open_visit_count,
        )
