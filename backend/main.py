from __future__ import annotations

import time
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from config import settings
from database import engine, Base

# Domain routers
from domains.identity.router import router as identity_router
from domains.master_data.router import router as master_data_router
from domains.patients.router import router as patients_router
from domains.visits.router import router as visits_router
from domains.claims.router import router as claims_router
from domains.payments.router import router as payments_router
from domains.work_queue.router import router as work_queue_router
from domains.audit.router import router as audit_router
from domains.search.router import router as search_router

logger = logging.getLogger("clinictraq")
logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting ClinicTraq backend — environment: %s", settings.ENVIRONMENT)
    # In production use Alembic; in dev optionally create tables
    if settings.ENVIRONMENT == "development":
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        except Exception as exc:
            logger.warning("Dev auto-migrate skipped (DB unreachable at startup): %s", exc)
    yield
    logger.info("Shutting down ClinicTraq backend")
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="ClinicTraq API",
        version="1.0.0",
        description="Medical billing and practice management platform",
        lifespan=lifespan,
        docs_url="/api/docs" if settings.DEBUG else None,
        redoc_url="/api/redoc" if settings.DEBUG else None,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "%s %s %d %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response

    # Global exception handlers
    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError):
        logger.warning("IntegrityError: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "A record with that value already exists."},
        )

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Resource not found."},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred."},
        )

    # Mount routers
    prefix = "/api/v1"
    app.include_router(identity_router, prefix=prefix)
    app.include_router(master_data_router, prefix=prefix)
    app.include_router(patients_router, prefix=prefix)
    app.include_router(visits_router, prefix=prefix)
    app.include_router(claims_router, prefix=prefix)
    app.include_router(payments_router, prefix=prefix)
    app.include_router(work_queue_router, prefix=prefix)
    app.include_router(audit_router, prefix=prefix)
    app.include_router(search_router, prefix=prefix)

    @app.get("/health", tags=["health"])
    async def health_check():
        return {"status": "ok", "environment": settings.ENVIRONMENT}

    return app


app = create_app()
