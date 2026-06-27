from __future__ import annotations

import asyncio
import logging
import uuid

from worker import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a synchronous Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="workers.claim_validator.validate_claim", bind=True, max_retries=3)
def validate_claim(self, claim_id: str, tenant_id: str):
    """Run ClaimValidator on a claim, write ClaimValidationIssue rows, update validation_status."""
    try:
        _run_async(_async_validate_claim(claim_id, tenant_id))
    except Exception as exc:
        logger.exception("validate_claim failed for %s: %s", claim_id, exc)
        raise self.retry(exc=exc, countdown=60)


async def _async_validate_claim(claim_id: str, tenant_id: str):
    from database import AsyncSessionLocal
    from domains.claims.models import Claim, ClaimValidationIssue
    from domains.claims.validation import ClaimValidator
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    claim_uuid = uuid.UUID(claim_id)
    tenant_uuid = uuid.UUID(tenant_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Claim)
            .where(Claim.id == claim_uuid, Claim.tenant_id == tenant_uuid)
            .options(
                selectinload(Claim.lines),
                selectinload(Claim.validation_issues),
            )
        )
        claim = result.scalar_one_or_none()
        if not claim:
            logger.warning("Claim %s not found for tenant %s", claim_id, tenant_id)
            return

        # Clear existing unresolved issues
        for issue in list(claim.validation_issues):
            if not issue.resolved:
                await db.delete(issue)
        await db.flush()

        validator = ClaimValidator(claim, db)
        issues_data = await validator.run_all()

        for issue_data in issues_data:
            issue = ClaimValidationIssue(
                tenant_id=tenant_uuid,
                claim_id=claim_uuid,
                **issue_data,
            )
            db.add(issue)

        has_blocking = any(i["severity"] == "blocking" for i in issues_data)
        claim.validation_status = (
            "invalid" if has_blocking else ("warnings" if issues_data else "valid")
        )
        await db.commit()
        logger.info(
            "Validated claim %s: status=%s, issues=%d",
            claim_id,
            claim.validation_status,
            len(issues_data),
        )


@celery_app.task(name="workers.claim_validator.validate_all_pending_claims")
def validate_all_pending_claims():
    """Nightly task: validate all claims with validation_status='pending'."""
    _run_async(_async_validate_all_pending())


async def _async_validate_all_pending():
    from database import AsyncSessionLocal
    from domains.claims.models import Claim
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Claim.id, Claim.tenant_id).where(Claim.validation_status == "pending").limit(5000)
        )
        rows = result.all()

    for row in rows:
        validate_claim.delay(str(row.id), str(row.tenant_id))
    logger.info("Queued %d claims for validation", len(rows))
