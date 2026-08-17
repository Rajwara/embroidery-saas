import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Branch, Factory, InventoryItem, Purchase, PurchaseLineItem, StockTransaction, Supplier, User
from app.schemas.purchase import (
    PurchaseCreateRequest,
    PurchaseDetailOut,
    PurchaseLineItemOut,
    PurchaseOut,
)

router = APIRouter()


def _purchase_total(db: Session, purchase_id: uuid.UUID) -> float:
    total = (
        db.query(func.coalesce(func.sum(PurchaseLineItem.line_total), 0))
        .filter(PurchaseLineItem.purchase_id == purchase_id)
        .scalar()
    )
    return float(total)


def _to_purchase_out(purchase: Purchase, total_amount: float) -> PurchaseOut:
    return PurchaseOut(
        id=purchase.id,
        branch_id=purchase.branch_id,
        supplier_id=purchase.supplier_id,
        purchase_number=purchase.purchase_number,
        purchase_date=purchase.purchase_date,
        notes=purchase.notes,
        total_amount=total_amount,
    )


def _build_purchase_detail(db: Session, purchase: Purchase) -> PurchaseDetailOut:
    """Manually assembles the nested lines -- Purchase carries no ORM
    relationships (same FK-columns-only convention as Lot/LotColour), so
    response_model can't derive this automatically from attribute access."""
    lines = (
        db.query(PurchaseLineItem)
        .filter(PurchaseLineItem.purchase_id == purchase.id)
        .order_by(PurchaseLineItem.created_at)
        .all()
    )
    total_amount = sum(float(line.line_total) for line in lines)
    return PurchaseDetailOut(
        **_to_purchase_out(purchase, total_amount).model_dump(),
        lines=[PurchaseLineItemOut.model_validate(line) for line in lines],
    )


@router.get("", response_model=list[PurchaseOut], operation_id="listPurchases")
def list_purchases(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    supplier_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("purchases.view")),
) -> list[PurchaseOut]:
    query = db.query(Purchase)
    if supplier_id:
        query = query.filter(Purchase.supplier_id == supplier_id)
    purchases = query.order_by(Purchase.purchase_number.desc()).offset(skip).limit(limit).all()
    return [_to_purchase_out(purchase, _purchase_total(db, purchase.id)) for purchase in purchases]


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=PurchaseDetailOut, operation_id="createPurchase"
)
def create_purchase(
    payload: PurchaseCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("purchases.create")),
) -> PurchaseDetailOut:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")
    supplier = db.get(Supplier, payload.supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="supplier_not_found")
    if not payload.lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="no_lines")
    for line in payload.lines:
        if line.quantity <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="quantity_must_be_positive")
        if line.unit_price <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="unit_price_must_be_positive")
        if line.inventory_item_id is not None and db.get(InventoryItem, line.inventory_item_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="inventory_item_not_found")

    # Locked for the rest of this transaction -- serializes concurrent
    # create_purchase calls so two requests can never be assigned the same
    # purchase_number (same pattern as create_lot).
    factory = db.query(Factory).with_for_update().first()
    if factory is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="factory_not_found")
    purchase_number = f"{factory.purchase_number_prefix}-{factory.next_purchase_number:06d}"
    factory.next_purchase_number += 1

    purchase = Purchase(
        tenant_id=user.tenant_id,
        branch_id=branch.id,
        supplier_id=supplier.id,
        purchase_number=purchase_number,
        purchase_date=payload.purchase_date,
        notes=payload.notes,
    )
    db.add(purchase)
    db.flush()  # populate purchase.id -- Python-side default, not set until flush

    lines: list[PurchaseLineItem] = []
    for line_payload in payload.lines:
        line = PurchaseLineItem(
            tenant_id=user.tenant_id,
            purchase_id=purchase.id,
            inventory_item_id=line_payload.inventory_item_id,
            description=line_payload.description,
            quantity=line_payload.quantity,
            unit_price=line_payload.unit_price,
            line_total=round(line_payload.quantity * line_payload.unit_price, 2),
        )
        db.add(line)
        lines.append(line)

        # "purchases update inventory" (ROADMAP.md Phase 3 item 8, wired up
        # now that InventoryItem exists) -- auto-receipt this line's
        # quantity against the linked item, same as any other stock receipt.
        if line_payload.inventory_item_id is not None:
            db.add(
                StockTransaction(
                    tenant_id=user.tenant_id,
                    inventory_item_id=line_payload.inventory_item_id,
                    transaction_type="receipt",
                    quantity=line_payload.quantity,
                    transaction_date=payload.purchase_date,
                    reference_type="purchase",
                    reference_id=purchase.id,
                    notes=f"Auto-created from Purchase {purchase_number}",
                )
            )

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="purchase",
        entity_id=purchase.id,
        new_values={
            "purchase_number": purchase_number,
            "supplier_id": str(supplier.id),
            "total_amount": str(sum(float(line.line_total) for line in lines)),
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(purchase)
    return _build_purchase_detail(db, purchase)


@router.get("/{purchase_id}", response_model=PurchaseDetailOut, operation_id="getPurchase")
def get_purchase(
    purchase_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("purchases.view")),
) -> PurchaseDetailOut:
    purchase = db.get(Purchase, purchase_id)
    if purchase is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="purchase_not_found")
    return _build_purchase_detail(db, purchase)
