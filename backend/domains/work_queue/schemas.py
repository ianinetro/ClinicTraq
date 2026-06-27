from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class WorkItemCreate(BaseModel):
    item_type: str
    title: str
    description: Optional[str] = None
    priority: str = "normal"
    patient_id: Optional[uuid.UUID] = None
    claim_id: Optional[uuid.UUID] = None
    payment_id: Optional[uuid.UUID] = None
    visit_id: Optional[uuid.UUID] = None
    assigned_to: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None
    extra_data: Optional[Dict[str, Any]] = None


class WorkItemUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None
    description: Optional[str] = None


class WorkItemNoteCreate(BaseModel):
    content: str


class WorkItemNoteResponse(BaseModel):
    id: uuid.UUID
    work_item_id: uuid.UUID
    content: str
    created_by: uuid.UUID
    created_at: datetime
    model_config = {"from_attributes": True}


class WorkItemResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    item_type: str
    status: str
    priority: str
    title: str
    description: Optional[str]
    patient_id: Optional[uuid.UUID]
    claim_id: Optional[uuid.UUID]
    payment_id: Optional[uuid.UUID]
    visit_id: Optional[uuid.UUID]
    assigned_to: Optional[uuid.UUID]
    due_date: Optional[datetime]
    last_action_at: Optional[datetime]
    resolved_at: Optional[datetime]
    escalated: bool
    escalated_at: Optional[datetime]
    created_at: datetime
    notes: List[WorkItemNoteResponse] = []
    model_config = {"from_attributes": True}


class WorkQueueSummary(BaseModel):
    total_open: int
    total_escalated: int
    by_type: Dict[str, int]
    by_priority: Dict[str, int]
