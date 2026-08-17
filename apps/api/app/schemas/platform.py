import uuid
from datetime import date, datetime

from pydantic import BaseModel


class PlatformDashboardOut(BaseModel):
    total_factories: int
    active_factories: int
    plan_breakdown: dict[str, int]
    status_breakdown: dict[str, int]
    total_users: int


class SubscriberFactoryOut(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool
    subscription_plan: str
    subscription_status: str
    subscription_renews_at: date | None
    user_count: int
    created_at: datetime


class SubscriberFactoryUpdateRequest(BaseModel):
    is_active: bool | None = None
    subscription_plan: str | None = None
    subscription_status: str | None = None
    subscription_renews_at: date | None = None


class TrialAccountCreateRequest(BaseModel):
    factory_name: str
    admin_email: str
    admin_full_name: str


class TrialAccountOut(BaseModel):
    tenant_id: uuid.UUID
    tenant_name: str
    admin_email: str
