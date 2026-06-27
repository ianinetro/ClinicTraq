from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, String, Text, event, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, Session

from database import Base


class AuditEvent(Base):
    """Append-only audit log. UPDATE and DELETE are blocked via event listeners."""

    __tablename__ = "audit_events"

    # Override id/updated_at to keep the base columns but mark append-only semantics
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    old_values: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    new_values: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    phi_accessed: Mapped[bool] = mapped_column(default=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )


# ── Append-only enforcement ───────────────────────────────────────────────────

@event.listens_for(AuditEvent, "before_update")
def _block_audit_update(mapper, connection, target):
    raise RuntimeError("AuditEvent records are append-only — updates are not permitted.")


@event.listens_for(AuditEvent, "before_delete")
def _block_audit_delete(mapper, connection, target):
    raise RuntimeError("AuditEvent records are append-only — deletes are not permitted.")
