from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class SearchResult(BaseModel):
    document_type: str
    document_id: str
    label: Optional[str]
    url_hint: Optional[str]
    rank: Optional[float]
    metadata: Optional[Dict[str, Any]]


class SearchResponse(BaseModel):
    query: str
    total: int
    results: List[SearchResult]
