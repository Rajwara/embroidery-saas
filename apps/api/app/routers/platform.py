"""
Platform Super Admin portal (Phase 5 item 7), minimal-ops-toolkit scope:
Platform Dashboard, Subscriber Factories, Trial Accounts. Deferred for now
(nothing concrete to build yet, same reasoning as Approval Configuration):
Subscription Plans catalog, Platform Billing, Support Requests, System
Health & Backups.

Gated on User.is_platform_admin (get_current_platform_admin), not a
separate identity system -- see project_platform_admin_architecture memory
for why this reuses the existing User/JWT stack.

Subscriber Factories deliberately exposes account/subscription metadata
only -- name, plan, status, user count -- never any tenant's business data
(parties, invoices, production, ...). Stage 1 has no mechanism for a
platform admin to view tenant business records at all, not even a
logged/time-limited grant (project_support_access_model memory).

Every route here is inherently cross-tenant, so unlike a normal tenant
router it must NOT rely on the app.tenant_id that
get_current_user/require_permission already set from the platform admin's
own JWT -- that's the admin's own tenant, irrelevant here. Routes that
write to per-tenant tables (roles, users, audit_log) call
set_tenant_context() again for whichever tenant they're actually operating
on, same pattern as scheduled_reports.py's internal endpoints.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import get_current_platform_admin
from app.email import send_invite_email
from app.models import PasswordResetToken, Tenant, User
from app.permissions_catalog import create_role_templates_for_tenant
from app.schemas.platform import (
    PlatformDashboardOut,
    SubscriberFactoryOut,
    SubscriberFactoryUpdateRequest,
    TrialAccountCreateRequest,
    TrialAccountOut,
)
from app.security import generate_reset_token, hash_password, hash_reset_token

router = APIRouter()

# Matches auth.py's RESET_TOKEN_TTL / users.py's INVITE_TOKEN_TTL -- a new
# tenant's first admin gets the same kind of forced-password-reset invite.
INVITE_TOKEN_TTL = timedelta(minutes=30)


def _to_subscriber_factory_out(db: Session, tenant: Tenant) -> SubscriberFactoryOut:
    user_count = db.query(User).filter(User.tenant_id == tenant.id).count()
    return SubscriberFactoryOut(
        id=tenant.id,
        name=tenant.name,
        is_active=tenant.is_active,
        subscription_plan=tenant.subscription_plan,
        subscription_status=tenant.subscription_status,
        subscription_renews_at=tenant.subscription_renews_at,
        user_count=user_count,
        created_at=tenant.created_at,
    )


@router.get("/platform/dashboard", response_model=PlatformDashboardOut, operation_id="getPlatformDashboard")
def get_platform_dashboard(
    db: Session = Depends(get_db), _admin: User = Depends(get_current_platform_admin)
) -> PlatformDashboardOut:
    tenants = db.query(Tenant).all()
    plan_breakdown: dict[str, int] = {}
    status_breakdown: dict[str, int] = {}
    for tenant in tenants:
        plan_breakdown[tenant.subscription_plan] = plan_breakdown.get(tenant.subscription_plan, 0) + 1
        status_breakdown[tenant.subscription_status] = status_breakdown.get(tenant.subscription_status, 0) + 1

    return PlatformDashboardOut(
        total_factories=len(tenants),
        active_factories=sum(1 for tenant in tenants if tenant.is_active),
        plan_breakdown=plan_breakdown,
        status_breakdown=status_breakdown,
        total_users=db.query(User).count(),
    )


@router.get(
    "/platform/factories", response_model=list[SubscriberFactoryOut], operation_id="listSubscriberFactories"
)
def list_subscriber_factories(
    db: Session = Depends(get_db), _admin: User = Depends(get_current_platform_admin)
) -> list[SubscriberFactoryOut]:
    user_counts = dict(db.query(User.tenant_id, func.count(User.id)).group_by(User.tenant_id).all())
    tenants = db.query(Tenant).order_by(Tenant.created_at).all()
    return [
        SubscriberFactoryOut(
            id=tenant.id,
            name=tenant.name,
            is_active=tenant.is_active,
            subscription_plan=tenant.subscription_plan,
            subscription_status=tenant.subscription_status,
            subscription_renews_at=tenant.subscription_renews_at,
            user_count=user_counts.get(tenant.id, 0),
            created_at=tenant.created_at,
        )
        for tenant in tenants
    ]


@router.patch(
    "/platform/factories/{tenant_id}",
    response_model=SubscriberFactoryOut,
    operation_id="updateSubscriberFactory",
)
def update_subscriber_factory(
    tenant_id: uuid.UUID,
    payload: SubscriberFactoryUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_platform_admin),
) -> SubscriberFactoryOut:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="tenant_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        current = getattr(tenant, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(tenant, field, value)

    if new_values:
        # audit_log's RLS requires app.tenant_id to match the row being
        # written -- override whatever get_current_platform_admin's own
        # get_current_user call set (the admin's own tenant).
        set_tenant_context(db, str(tenant.id))
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=tenant.id,
            actor_user_id=admin.id,
            action="update",
            entity_type="tenant",
            entity_id=tenant.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    db.refresh(tenant)
    return _to_subscriber_factory_out(db, tenant)


@router.post(
    "/platform/trial-accounts",
    status_code=status.HTTP_201_CREATED,
    response_model=TrialAccountOut,
    operation_id="createTrialAccount",
)
def create_trial_account(
    payload: TrialAccountCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_platform_admin),
) -> TrialAccountOut:
    existing = db.query(User).filter(User.email == payload.admin_email).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="email_already_in_use")

    # tenants carries no RLS policy (it's the tenant boundary itself, see
    # e650e40e66c3's migration docstring) -- insertable through the app's
    # normal restricted session with no special context.
    tenant = Tenant(name=payload.factory_name)
    db.add(tenant)
    db.flush()

    # roles/users/audit_log all require app.tenant_id to match on write;
    # switch context to the brand-new tenant for the rest of this request.
    set_tenant_context(db, str(tenant.id))
    create_role_templates_for_tenant(db, tenant.id)

    new_admin = User(
        tenant_id=tenant.id,
        email=payload.admin_email,
        full_name=payload.admin_full_name,
        # Same pattern as routers/users.py::invite_user -- random, unusable
        # password; the invite email's reset-password link is what actually
        # lets them in. is_super_admin, not is_platform_admin: this is the
        # new factory's own owner account, not another platform operator.
        hashed_password=hash_password(generate_reset_token()),
        is_super_admin=True,
        is_active=True,
    )
    db.add(new_admin)
    db.flush()

    raw_token = generate_reset_token()
    db.add(
        PasswordResetToken(
            tenant_id=tenant.id,
            user_id=new_admin.id,
            token_hash=hash_reset_token(raw_token),
            expires_at=datetime.now(timezone.utc) + INVITE_TOKEN_TTL,
        )
    )

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=tenant.id,
        actor_user_id=admin.id,
        action="create",
        entity_type="tenant",
        entity_id=tenant.id,
        new_values={"name": tenant.name, "admin_email": payload.admin_email},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()

    invite_url = f"/reset-password?token={raw_token}"
    # No Factory row exists yet for a brand-new tenant -- creating one is
    # step one of /onboarding, which this new admin lands on after their
    # first login. So there's no Factory.notification_from_* to read yet;
    # send_invite_email falls back to email.py's DEFAULT_FROM_ADDRESS.
    send_invite_email(payload.admin_email, invite_url, tenant.name)

    return TrialAccountOut(tenant_id=tenant.id, tenant_name=tenant.name, admin_email=new_admin.email)
