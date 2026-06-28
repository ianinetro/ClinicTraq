from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from domains.identity.dependencies import TenantContext, require_permission
from domains.scheduling.models import Appointment
from domains.scheduling.schemas import AppointmentCreate, AppointmentResponse, AppointmentUpdate

router = APIRouter(tags=["scheduling"])


async def _require_appointment(
    appointment_id: uuid.UUID,
    ctx: TenantContext,
    db: AsyncSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == ctx.tenant_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.get("/appointments", response_model=List[AppointmentResponse])
async def list_appointments(
    date: Optional[date] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    provider_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    ctx: TenantContext = Depends(require_permission("appointments:read")),
    db: AsyncSession = Depends(get_db),
) -> List[AppointmentResponse]:
    query = select(Appointment).where(Appointment.tenant_id == ctx.tenant_id)

    if date is not None:
        day_start = datetime(date.year, date.month, date.day, 0, 0, 0)
        day_end = datetime(date.year, date.month, date.day, 23, 59, 59)
        query = query.where(Appointment.start_time >= day_start, Appointment.start_time <= day_end)

    if provider_id is not None:
        query = query.where(Appointment.provider_id == provider_id)

    if status is not None:
        query = query.where(Appointment.status == status)

    query = query.order_by(Appointment.start_time)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/appointments", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    ctx: TenantContext = Depends(require_permission("appointments:write")),
    db: AsyncSession = Depends(get_db),
) -> AppointmentResponse:
    appt = Appointment(
        tenant_id=ctx.tenant_id,
        created_by=ctx.user_id,
        **payload.model_dump(),
    )
    db.add(appt)
    await db.commit()
    await db.refresh(appt)
    return appt


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: uuid.UUID,
    ctx: TenantContext = Depends(require_permission("appointments:read")),
    db: AsyncSession = Depends(get_db),
) -> AppointmentResponse:
    return await _require_appointment(appointment_id, ctx, db)


@router.patch("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentUpdate,
    ctx: TenantContext = Depends(require_permission("appointments:write")),
    db: AsyncSession = Depends(get_db),
) -> AppointmentResponse:
    appt = await _require_appointment(appointment_id, ctx, db)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(appt, field, value)
    await db.commit()
    await db.refresh(appt)
    return appt


@router.delete("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    ctx: TenantContext = Depends(require_permission("appointments:write")),
    db: AsyncSession = Depends(get_db),
) -> AppointmentResponse:
    appt = await _require_appointment(appointment_id, ctx, db)
    appt.status = "cancelled"
    await db.commit()
    await db.refresh(appt)
    return appt
