"""
Factory-facing Subscription/Billing screen (Phase 5 item 6). Read-only in
Stage 1 -- see Tenant.subscription_* in app/models/tenant.py for why these
fields live directly on Tenant instead of a separate Plan/Billing table.

Fetches by user.tenant_id via db.get() rather than relying on RLS, matching
auth.py's /me endpoint -- Tenant is the root of the tenant hierarchy, not a
tenant-scoped child table, so there's no RLS policy on it to lean on.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import require_permission
from app.models import Tenant, User
from app.schemas.subscription import SubscriptionOut

router = APIRouter()


@router.get("/subscription", response_model=SubscriptionOut, operation_id="getSubscription")
def get_subscription(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("factories.view")),
) -> SubscriptionOut:
    tenant = db.get(Tenant, user.tenant_id)
    if tenant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="tenant_not_found")
    return SubscriptionOut(
        tenant_name=tenant.name,
        plan=tenant.subscription_plan,
        status=tenant.subscription_status,
        renews_at=tenant.subscription_renews_at,
    )
