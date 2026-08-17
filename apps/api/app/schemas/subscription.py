from datetime import date

from pydantic import BaseModel


class SubscriptionOut(BaseModel):
    tenant_name: str
    plan: str
    status: str
    renews_at: date | None
