from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class SearchIndex(Base):
    __tablename__ = "search_index"
    __table_args__ = (
        UniqueConstraint("tenant_id", "document_type", "document_id", name="uq_search_index_doc"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # document_id is a string representation of the primary key (UUID or other)
    document_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    search_vector: Mapped[Optional[Any]] = mapped_column(TSVECTOR)
    doc_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    # Human-readable label shown in results
    label: Mapped[Optional[str]] = mapped_column(String(255))
    # URL/path hint for the frontend to deep-link into
    url_hint: Mapped[Optional[str]] = mapped_column(String(255))
