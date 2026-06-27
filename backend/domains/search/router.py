from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import User
from domains.search.models import SearchIndex
from domains.search.schemas import SearchResponse, SearchResult

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=1, description="Search query"),
    types: Optional[str] = Query(None, description="Comma-separated document types to filter"),
    limit: int = Query(20, le=100),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("search:read")),
):
    # Sanitize query — replace special characters, wrap in plainto_tsquery for safety
    # We use plainto_tsquery which handles arbitrary user input safely
    type_list = [t.strip() for t in types.split(",")] if types else None

    # Use raw SQL for tsvector full-text search with ranking
    sql_parts = [
        "SELECT",
        "    si.document_type,",
        "    si.document_id,",
        "    si.label,",
        "    si.url_hint,",
        "    si.metadata,",
        "    ts_rank(si.search_vector, plainto_tsquery('english', :query)) AS rank",
        "FROM search_index si",
        "WHERE si.tenant_id = :tenant_id",
        "  AND si.search_vector @@ plainto_tsquery('english', :query)",
    ]
    params = {"query": q, "tenant_id": str(ctx.tenant_id), "limit": limit}

    if type_list:
        sql_parts.append("  AND si.document_type = ANY(:types)")
        params["types"] = type_list

    sql_parts.append("ORDER BY rank DESC")
    sql_parts.append("LIMIT :limit")

    sql = "\n".join(sql_parts)
    result = await db.execute(text(sql), params)
    rows = result.fetchall()

    results = [
        SearchResult(
            document_type=row.document_type,
            document_id=row.document_id,
            label=row.label,
            url_hint=row.url_hint,
            rank=float(row.rank) if row.rank is not None else None,
            metadata=row.metadata,
        )
        for row in rows
    ]

    return SearchResponse(query=q, total=len(results), results=results)
