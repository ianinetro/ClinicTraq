from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

import httpx

from worker import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="workers.eligibility_checker.check_eligibility", bind=True, max_retries=3)
def check_eligibility(self, eligibility_check_id: str, tenant_id: str):
    """Check eligibility for a single PatientInsurance record via clearinghouse API."""
    try:
        _run_async(_async_check_eligibility(eligibility_check_id, tenant_id))
    except Exception as exc:
        logger.exception("check_eligibility failed for %s: %s", eligibility_check_id, exc)
        raise self.retry(exc=exc, countdown=120)


async def _async_check_eligibility(eligibility_check_id: str, tenant_id: str):
    from database import AsyncSessionLocal
    from domains.patients.models import EligibilityCheck, PatientInsurance
    from domains.master_data.models import Payer
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    check_uuid = uuid.UUID(eligibility_check_id)
    tenant_uuid = uuid.UUID(tenant_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(EligibilityCheck)
            .where(EligibilityCheck.id == check_uuid)
        )
        check = result.scalar_one_or_none()
        if not check:
            logger.warning("EligibilityCheck %s not found", eligibility_check_id)
            return

        ins_result = await db.execute(
            select(PatientInsurance).where(PatientInsurance.id == check.patient_insurance_id)
        )
        insurance = ins_result.scalar_one_or_none()
        if not insurance:
            check.status = "error"
            check.error_message = "Insurance record not found"
            await db.commit()
            return

        payer = None
        if insurance.payer_id:
            payer_result = await db.execute(
                select(Payer).where(Payer.id == insurance.payer_id)
            )
            payer = payer_result.scalar_one_or_none()

        # Build clearinghouse request payload
        # In production this would call a real clearinghouse (e.g., Change Healthcare, Availity)
        # using their 270/271 X12 API or a REST wrapper
        clearinghouse_payload = {
            "member_id": getattr(insurance, "member_id", None) or getattr(insurance, "subscriber_id", None),
            "group_number": insurance.group_number,
            "payer_id": payer.payer_id if payer else None,
            "patient_id": str(check.patient_id),
        }

        try:
            # Simulated clearinghouse call structure
            # async with httpx.AsyncClient(timeout=30) as client:
            #     response = await client.post(
            #         "https://api.clearinghouse.example.com/eligibility/270",
            #         json=clearinghouse_payload,
            #         headers={"Authorization": f"Bearer {settings.CLEARINGHOUSE_API_KEY}"},
            #     )
            #     response.raise_for_status()
            #     data = response.json()

            # Simulated successful response structure (real 271 data would populate these)
            data = {
                "coverage_active": True,
                "copay": None,
                "deductible": None,
                "deductible_met": None,
                "out_of_pocket": None,
                "out_of_pocket_met": None,
                "coinsurance_pct": None,
                "raw_response": {"status": "simulated", "payload": clearinghouse_payload},
            }

            check.status = "active" if data.get("coverage_active") else "inactive"
            check.response_data = data.get("raw_response")
            check.copay_amount = data.get("copay")
            check.deductible_amount = data.get("deductible")
            check.deductible_met = data.get("deductible_met")
            check.out_of_pocket_max = data.get("out_of_pocket")
            check.out_of_pocket_met = data.get("out_of_pocket_met")
            check.coinsurance_pct = data.get("coinsurance_pct")
            check.error_message = None

            # Update insurance record with latest eligibility data
            if data.get("copay") is not None:
                insurance.copay_amount = data["copay"]
            if data.get("deductible") is not None:
                insurance.deductible_amount = data["deductible"]

        except httpx.HTTPError as exc:
            check.status = "error"
            check.error_message = f"Clearinghouse HTTP error: {exc}"
        except Exception as exc:
            check.status = "error"
            check.error_message = str(exc)

        await db.commit()
        logger.info("Eligibility check %s completed: status=%s", eligibility_check_id, check.status)


@celery_app.task(name="workers.eligibility_checker.check_pending_eligibility")
def check_pending_eligibility():
    """Hourly beat task: process all pending eligibility checks."""
    _run_async(_async_check_pending())


async def _async_check_pending():
    from database import AsyncSessionLocal
    from domains.patients.models import EligibilityCheck
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(EligibilityCheck.id).where(EligibilityCheck.status == "pending").limit(1000)
        )
        rows = result.all()

    for row in rows:
        check_eligibility.delay(str(row[0]), "")  # tenant resolved from check record
    logger.info("Queued %d eligibility checks", len(rows))
