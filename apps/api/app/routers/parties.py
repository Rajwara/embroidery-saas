import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Party, User
from app.permissions import user_has_permission
from app.schemas.party import (
    PartyCreateRequest,
    PartyOut,
    PartyUpdateRequest,
    PartyWithBalanceOut,
)

router = APIRouter()


def _serialize(party: Party, can_see_money: bool) -> PartyOut | PartyWithBalanceOut:
    return (PartyWithBalanceOut if can_see_money else PartyOut).model_validate(party)


@router.get("")
def list_parties(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    is_active: bool = True,
    name: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("parties.view")),
):
    query = db.query(Party).filter(Party.is_active == is_active)
    if name:
        query = query.filter(Party.name.ilike(f"%{name}%"))
    rows = query.order_by(Party.name).offset(skip).limit(limit).all()

    can_see_money = user_has_permission(db, user, "parties.see_money")
    return [_serialize(p, can_see_money) for p in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_party(
    payload: PartyCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("parties.create")),
):
    party = Party(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(party)
    db.flush()  # populate party.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="party",
        entity_id=party.id,
        new_values=payload.model_dump(),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    # db.commit() ends the transaction that set_tenant_context() scoped its
    # SET LOCAL to -- re-establish it before the refresh below re-queries
    # parties under RLS. See app/db.py's set_tenant_context docstring.
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(party)

    can_see_money = user_has_permission(db, user, "parties.see_money")
    return _serialize(party, can_see_money)


@router.get("/{party_id}")
def get_party(
    party_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("parties.view")),
):
    party = db.get(Party, party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="party_not_found")

    can_see_money = user_has_permission(db, user, "parties.see_money")
    return _serialize(party, can_see_money)


@router.patch("/{party_id}")
def update_party(
    party_id: uuid.UUID,
    payload: PartyUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("parties.edit")),
):
    party = db.get(Party, party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="party_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        current = getattr(party, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(party, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="party",
            entity_id=party.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(party)

    can_see_money = user_has_permission(db, user, "parties.see_money")
    return _serialize(party, can_see_money)
