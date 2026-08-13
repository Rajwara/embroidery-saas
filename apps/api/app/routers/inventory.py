import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Branch, InventoryItem, PurchaseRequired, StockTransaction, User
from app.schemas.inventory import (
    InventoryItemCreateRequest,
    InventoryItemOut,
    InventoryItemUpdateRequest,
    StockTransactionCreateRequest,
    StockTransactionOut,
)

router = APIRouter()


def _current_stock(db: Session, item_id: uuid.UUID) -> int:
    total = (
        db.query(func.coalesce(func.sum(StockTransaction.quantity), 0))
        .filter(StockTransaction.inventory_item_id == item_id)
        .scalar()
    )
    return int(total)


def _to_item_out(item: InventoryItem, current_stock: int) -> InventoryItemOut:
    return InventoryItemOut(
        id=item.id,
        branch_id=item.branch_id,
        name=item.name,
        unit=item.unit,
        category=item.category,
        minimum_threshold=item.minimum_threshold,
        notes=item.notes,
        is_active=item.is_active,
        current_stock=current_stock,
        is_below_threshold=current_stock < item.minimum_threshold,
    )


@router.get("", response_model=list[InventoryItemOut], operation_id="listInventoryItems")
def list_inventory_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    branch_id: uuid.UUID | None = None,
    is_active: bool = True,
    below_threshold_only: bool = False,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("inventory.view")),
) -> list[InventoryItemOut]:
    query = db.query(InventoryItem).filter(InventoryItem.is_active == is_active)
    if branch_id:
        query = query.filter(InventoryItem.branch_id == branch_id)
    items = query.order_by(InventoryItem.name).offset(skip).limit(limit).all()
    results = [_to_item_out(item, _current_stock(db, item.id)) for item in items]
    if below_threshold_only:
        results = [r for r in results if r.is_below_threshold]
    return results


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=InventoryItemOut, operation_id="createInventoryItem"
)
def create_inventory_item(
    payload: InventoryItemCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("inventory.create")),
) -> InventoryItemOut:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")

    item = InventoryItem(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(item)
    db.flush()  # populate item.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="inventory_item",
        entity_id=item.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(item)
    return _to_item_out(item, 0)


@router.get("/{item_id}", response_model=InventoryItemOut, operation_id="getInventoryItem")
def get_inventory_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("inventory.view")),
) -> InventoryItemOut:
    item = db.get(InventoryItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="item_not_found")
    return _to_item_out(item, _current_stock(db, item.id))


@router.patch("/{item_id}", response_model=InventoryItemOut, operation_id="updateInventoryItem")
def update_inventory_item(
    item_id: uuid.UUID,
    payload: InventoryItemUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("inventory.edit")),
) -> InventoryItemOut:
    item = db.get(InventoryItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="item_not_found")

    updates = payload.model_dump(exclude_none=True)
    if "branch_id" in updates and db.get(Branch, updates["branch_id"]) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in updates.items():
        current = getattr(item, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(item, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="inventory_item",
            entity_id=item.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(item)
    return _to_item_out(item, _current_stock(db, item.id))


@router.get(
    "/{item_id}/transactions",
    response_model=list[StockTransactionOut],
    operation_id="listStockTransactions",
)
def list_stock_transactions(
    item_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("inventory.view")),
) -> list[StockTransaction]:
    item = db.get(InventoryItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="item_not_found")
    return (
        db.query(StockTransaction)
        .filter(StockTransaction.inventory_item_id == item_id)
        .order_by(StockTransaction.transaction_date.desc(), StockTransaction.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post(
    "/{item_id}/transactions",
    status_code=status.HTTP_201_CREATED,
    response_model=StockTransactionOut,
    operation_id="createStockTransaction",
)
def create_stock_transaction(
    item_id: uuid.UUID,
    payload: StockTransactionCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("inventory.create")),
) -> StockTransaction:
    item = db.get(InventoryItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="item_not_found")
    if payload.quantity <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="quantity_must_be_positive")

    if payload.transaction_type == "receipt":
        signed_quantity = payload.quantity
    elif payload.transaction_type == "issue":
        signed_quantity = -payload.quantity
        if _current_stock(db, item.id) < payload.quantity:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="insufficient_stock")
    else:  # adjustment
        if payload.adjustment_direction is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="adjustment_direction_required")
        signed_quantity = payload.quantity if payload.adjustment_direction == "increase" else -payload.quantity
        if payload.adjustment_direction == "decrease" and _current_stock(db, item.id) < payload.quantity:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="insufficient_stock")

    transaction = StockTransaction(
        tenant_id=user.tenant_id,
        inventory_item_id=item.id,
        transaction_type=payload.transaction_type,
        quantity=signed_quantity,
        transaction_date=payload.transaction_date,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        notes=payload.notes,
    )
    db.add(transaction)
    db.flush()  # populate transaction.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create_transaction",
        entity_type="inventory_item",
        entity_id=item.id,
        new_values={"transaction_type": payload.transaction_type, "quantity": signed_quantity},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    # Auto-populate Purchase Required (ROADMAP.md item 3) if this
    # transaction pushed stock below threshold and there's no other open
    # (non-"received") request for this item already -- never more than
    # one open request per item at a time. The transaction was already
    # flushed above, so _current_stock already reflects it -- adding
    # signed_quantity again here would double-count.
    new_stock = _current_stock(db, item.id)
    if new_stock < item.minimum_threshold:
        existing_open = (
            db.query(PurchaseRequired)
            .filter(
                PurchaseRequired.inventory_item_id == item.id,
                PurchaseRequired.status != "received",
            )
            .first()
        )
        if existing_open is None:
            db.add(
                PurchaseRequired(
                    tenant_id=user.tenant_id,
                    inventory_item_id=item.id,
                    status="purchase_required",
                    requested_quantity=item.minimum_threshold,
                )
            )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(transaction)
    return transaction
