import uuid
from datetime import datetime

from pydantic import BaseModel


class ScheduledReportSettingCreateRequest(BaseModel):
    branch_id: uuid.UUID | None = None
    report_type: str
    frequency: str
    recipient_email: str


class ScheduledReportSettingUpdateRequest(BaseModel):
    frequency: str | None = None
    recipient_email: str | None = None
    is_active: bool | None = None


class ScheduledReportSettingOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID | None
    report_type: str
    frequency: str
    recipient_email: str
    is_active: bool
    last_sent_at: datetime | None

    model_config = {"from_attributes": True}


class DueScheduledReportOut(BaseModel):
    """Internal-only -- what the worker needs to fetch the PDF and send the
    email for one due setting. tenant_id lets the worker's log/error
    messages identify which tenant a failure belongs to; it plays no role
    in authorization (the internal endpoints authenticate by shared secret
    and set RLS tenant context themselves from this same id server-side)."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    report_type: str
    recipient_email: str
