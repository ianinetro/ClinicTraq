from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from config import settings

# celery_app is a stub when Redis is not configured; the API runs fine without it
celery_app = Celery(
    "clinictraq",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "workers.claim_validator",
        "workers.era_importer",
        "workers.reconciler",
        "workers.eligibility_checker",
        "workers.statement_generator",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "workers.claim_validator.*": {"queue": "claims"},
        "workers.era_importer.*": {"queue": "payments"},
        "workers.reconciler.*": {"queue": "reconciler"},
        "workers.eligibility_checker.*": {"queue": "eligibility"},
        "workers.statement_generator.*": {"queue": "statements"},
    },
)

celery_app.conf.beat_schedule = {
    # Nightly claim validation — 2 AM UTC
    "nightly-claim-validation": {
        "task": "workers.claim_validator.validate_all_pending_claims",
        "schedule": crontab(hour=2, minute=0),
        "args": [],
    },
    # Daily reconciler — 3 AM UTC
    "daily-reconciler": {
        "task": "workers.reconciler.run_reconciler_all_tenants",
        "schedule": crontab(hour=3, minute=0),
        "args": [],
    },
    # Hourly eligibility check
    "hourly-eligibility-checker": {
        "task": "workers.eligibility_checker.check_pending_eligibility",
        "schedule": crontab(minute=0),
        "args": [],
    },
    # Nightly statement generator — 4 AM UTC
    "nightly-statement-generator": {
        "task": "workers.statement_generator.generate_statements_all_tenants",
        "schedule": crontab(hour=4, minute=0),
        "args": [],
    },
}
