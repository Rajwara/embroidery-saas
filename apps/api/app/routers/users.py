"""
User Management (Phase 5 item 5). A new user is invited, not created with a
password an admin would end up knowing: invite_user generates a random
unusable password (the account can't log in with it) plus a
PasswordResetToken, and emails a "set your password" link that hits the
same POST /auth/reset-password endpoint an ordinary forgot-password flow
uses -- an invite is functionally a forced password reset for a brand-new
account, so no new token/accept-invite endpoint was needed.

Deactivation (is_active=False) is the only removal path -- no hard delete,
matching every other is_active-flag entity in this codebase (Machine,
InventoryItem, Branch, ...) and avoiding orphaned FKs from audit_log/roles/
production entries that reference a deleted user's id.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.email import send_invite_email
from app.models import Factory, PasswordResetToken, Role, User
from app.schemas.users import UserInviteRequest, UserOut, UserUpdateRequest
from app.security import generate_reset_token, hash_password, hash_reset_token

router = APIRouter()

# Matches auth.py's RESET_TOKEN_TTL -- an invite link is the same kind of
# token with different email copy, see this module's docstring.
INVITE_TOKEN_TTL = timedelta(minutes=30)


@router.get("/users", response_model=list[UserOut], operation_id="listUsers")
def list_users(
    db: Session = Depends(get_db), _user: User = Depends(require_permission("users.view"))
) -> list[User]:
    return db.query(User).order_by(User.full_name).all()


@router.post(
    "/users", status_code=status.HTTP_201_CREATED, response_model=UserOut, operation_id="inviteUser"
)
def invite_user(
    payload: UserInviteRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("users.create")),
) -> User:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="email_already_in_use")

    roles: list[Role] = []
    if payload.role_ids:
        roles = db.query(Role).filter(Role.id.in_(payload.role_ids)).all()
        found_ids = {r.id for r in roles}
        missing = set(payload.role_ids) - found_ids
        if missing:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown_role_ids: {sorted(str(m) for m in missing)}")

    new_user = User(
        tenant_id=user.tenant_id,
        email=payload.email,
        full_name=payload.full_name,
        # Random, never communicated to anyone -- unusable until the invite
        # link's reset-password flow overwrites it. Not None/empty because
        # hashed_password is NOT NULL and verify_password must safely fail
        # against it (a real bcrypt hash of an unguessable value does).
        hashed_password=hash_password(generate_reset_token()),
        is_active=True,
    )
    new_user.roles = roles
    db.add(new_user)
    db.flush()  # populate new_user.id -- Python-side default, not set until flush

    raw_token = generate_reset_token()
    db.add(
        PasswordResetToken(
            tenant_id=user.tenant_id,
            user_id=new_user.id,
            token_hash=hash_reset_token(raw_token),
            expires_at=datetime.now(timezone.utc) + INVITE_TOKEN_TTL,
        )
    )

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="invite",
        entity_type="user",
        entity_id=new_user.id,
        new_values={"email": payload.email, "full_name": payload.full_name},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(new_user)

    factory = db.query(Factory).first()
    factory_name = factory.name if factory else "Embroidery SaaS"
    invite_url = f"/reset-password?token={raw_token}"
    send_invite_email(
        payload.email,
        invite_url,
        factory_name,
        from_name=factory.notification_from_name if factory else None,
        from_email=factory.notification_from_email if factory else None,
        reply_to=factory.notification_reply_to_email if factory else None,
    )

    return new_user


@router.patch("/users/{user_id}", response_model=UserOut, operation_id="updateUser")
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("users.edit")),
) -> User:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")
    if target.id == user.id and payload.is_active is False:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="cannot_deactivate_self")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        current = getattr(target, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(target, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="user",
            entity_id=target.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(target)
    return target
