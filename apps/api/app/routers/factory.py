from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import get_current_super_admin, require_permission
from app.models import Factory, User
from app.schemas.factory import FactoryCreateRequest, FactoryOut, FactoryUpdateRequest

router = APIRouter()


def _get_tenant_factory(db: Session) -> Factory | None:
    # RLS + Factory.tenant_id's unique constraint together guarantee at most
    # one visible row -- no manual tenant_id filter needed, same as every
    # other router in this codebase.
    return db.query(Factory).first()


@router.get("", response_model=FactoryOut, operation_id="getFactory")
def get_factory(
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("factories.view")),
) -> Factory:
    factory = _get_tenant_factory(db)
    if factory is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="factory_not_found")
    return factory


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=FactoryOut, operation_id="createFactory"
)
def create_factory(
    payload: FactoryCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_super_admin),
) -> Factory:
    # No factories.create permission exists (deliberate -- see
    # permissions_catalog.py) -- gated on super-admin directly instead, same
    # pattern as roles.py's set_permission_override.
    if _get_tenant_factory(db) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="factory_already_exists")

    factory = Factory(tenant_id=admin.tenant_id, **payload.model_dump())
    db.add(factory)
    db.flush()  # populate factory.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=admin.tenant_id,
        actor_user_id=admin.id,
        action="create",
        entity_type="factory",
        entity_id=factory.id,
        new_values=payload.model_dump(),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(admin.tenant_id))
    db.refresh(factory)
    return factory


@router.patch("", response_model=FactoryOut, operation_id="updateFactory")
def update_factory(
    payload: FactoryUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("factories.edit")),
) -> Factory:
    factory = _get_tenant_factory(db)
    if factory is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="factory_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        current = getattr(factory, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(factory, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="factory",
            entity_id=factory.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(factory)
    return factory
