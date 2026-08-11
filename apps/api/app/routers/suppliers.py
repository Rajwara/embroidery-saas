import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Supplier, User
from app.permissions import user_has_permission
from app.schemas.supplier import (
    SupplierCreateRequest,
    SupplierOut,
    SupplierUpdateRequest,
    SupplierWithBalanceOut,
)

router = APIRouter()


def _serialize(supplier: Supplier, can_see_money: bool) -> SupplierOut | SupplierWithBalanceOut:
    return (SupplierWithBalanceOut if can_see_money else SupplierOut).model_validate(supplier)


@router.get("")
def list_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    is_active: bool = True,
    name: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("suppliers.view")),
):
    query = db.query(Supplier).filter(Supplier.is_active == is_active)
    if name:
        query = query.filter(Supplier.name.ilike(f"%{name}%"))
    rows = query.order_by(Supplier.name).offset(skip).limit(limit).all()

    can_see_money = user_has_permission(db, user, "suppliers.see_money")
    return [_serialize(s, can_see_money) for s in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("suppliers.create")),
):
    supplier = Supplier(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(supplier)
    db.commit()
    # db.commit() ends the transaction that set_tenant_context() scoped its
    # SET LOCAL to -- re-establish it before the refresh below re-queries
    # suppliers under RLS. See app/db.py's set_tenant_context docstring.
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(supplier)

    can_see_money = user_has_permission(db, user, "suppliers.see_money")
    return _serialize(supplier, can_see_money)


@router.get("/{supplier_id}")
def get_supplier(
    supplier_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("suppliers.view")),
):
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="supplier_not_found")

    can_see_money = user_has_permission(db, user, "suppliers.see_money")
    return _serialize(supplier, can_see_money)


@router.patch("/{supplier_id}")
def update_supplier(
    supplier_id: uuid.UUID,
    payload: SupplierUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("suppliers.edit")),
):
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="supplier_not_found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(supplier, field, value)

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(supplier)

    can_see_money = user_has_permission(db, user, "suppliers.see_money")
    return _serialize(supplier, can_see_money)
