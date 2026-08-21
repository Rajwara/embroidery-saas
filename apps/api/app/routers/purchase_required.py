import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_internal_secret, require_permission
from app.models import InventoryItem, PurchaseRequired, StockTransaction, Tenant, User
from app.models.purchase_required import PURCHASE_REQUIRED_CLOSED_STATUSES, PURCHASE_REQUIRED_STATUSES
from app.routers.inventory import maybe_open_purchase_required
from app.schemas.inventory import (
    AdvancePurchaseRequiredRequest,
    PurchaseRequiredOut,
    RejectPurchaseRequiredRequest,
)

router = APIRouter()


def _current_stock(db: Session, item_id: uuid.UUID) -> int:
    total = (
        db.query(func.coalesce(func.sum(StockTransaction.quantity), 0))
        .filter(StockTransaction.inventory_item_id == item_id)
        .scalar()
    )
    return int(total)


def _to_out(request_row: PurchaseRequired, item: InventoryItem, current_stock: int) -> PurchaseRequiredOut:
    return PurchaseRequiredOut(
        id=request_row.id,
        inventory_item_id=request_row.inventory_item_id,
        status=request_row.status,
        requested_quantity=request_row.requested_quantity,
        notes=request_row.notes,
        rejection_reason=request_row.rejection_reason,
        item_name=item.name,
        item_unit=item.unit,
        current_stock=current_stock,
    )


@router.get("", response_model=list[PurchaseRequiredOut], operation_id="listPurchaseRequired")
def list_purchase_required(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(None, alias="status"),
    open_only: bool = False,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("inventory.view")),
) -> list[PurchaseRequiredOut]:
    query = db.query(PurchaseRequired)
    if status_filter:
        query = query.filter(PurchaseRequired.status == status_filter)
    if open_only:
        query = query.filter(PurchaseRequired.status.not_in(PURCHASE_REQUIRED_CLOSED_STATUSES))
    rows = query.order_by(PurchaseRequired.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for row in rows:
        item = db.get(InventoryItem, row.inventory_item_id)
        results.append(_to_out(row, item, _current_stock(db, item.id)))
    return results


@router.post(
    "/{request_id}/advance", response_model=PurchaseRequiredOut, operation_id="advancePurchaseRequired"
)
def advance_purchase_required(
    request_id: uuid.UUID,
    payload: AdvancePurchaseRequiredRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("inventory.edit")),
) -> PurchaseRequiredOut:
    row = db.get(PurchaseRequired, request_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="purchase_required_not_found")

    current_index = PURCHASE_REQUIRED_STATUSES.index(row.status)
    if current_index == len(PURCHASE_REQUIRED_STATUSES) - 1:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="already_received")
    next_status = PURCHASE_REQUIRED_STATUSES[current_index + 1]

    old_status = row.status
    row.status = next_status

    ip_address, user_agent = client_meta(request)
    new_values = {"status": next_status}

    if next_status == "received":
        received_quantity = payload.received_quantity or row.requested_quantity
        if received_quantity <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="received_quantity_must_be_positive")
        db.add(
            StockTransaction(
                tenant_id=user.tenant_id,
                inventory_item_id=row.inventory_item_id,
                transaction_type="receipt",
                quantity=received_quantity,
                transaction_date=date.today(),
                reference_type=None,
                notes=f"Auto-created from Purchase Required {row.id} advancing to received",
            )
        )
        new_values["received_quantity"] = received_quantity

    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="advance",
        entity_type="purchase_required",
        entity_id=row.id,
        old_values={"status": old_status},
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(row)
    item = db.get(InventoryItem, row.inventory_item_id)
    return _to_out(row, item, _current_stock(db, item.id))


@router.post(
    "/{request_id}/reject", response_model=PurchaseRequiredOut, operation_id="rejectPurchaseRequired"
)
def reject_purchase_required(
    request_id: uuid.UUID,
    payload: RejectPurchaseRequiredRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("inventory.edit")),
) -> PurchaseRequiredOut:
    row = db.get(PurchaseRequired, request_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="purchase_required_not_found")
    if row.status == "received":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="already_received")
    if row.status == "rejected":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="already_rejected")

    old_status = row.status
    row.status = "rejected"
    row.rejection_reason = payload.reason

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="reject",
        entity_type="purchase_required",
        entity_id=row.id,
        old_values={"status": old_status},
        new_values={"status": "rejected", "rejection_reason": payload.reason},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(row)
    item = db.get(InventoryItem, row.inventory_item_id)
    return _to_out(row, item, _current_stock(db, item.id))


# ---------------------------------------------------------------------------
# Internal (worker-only, shared-secret authenticated)
# ---------------------------------------------------------------------------


@router.post("/internal/reorder-check", operation_id="internalCheckReorderThresholds")
def internal_check_reorder_thresholds(
    db: Session = Depends(get_db),
    _secret: None = Depends(require_internal_secret),
) -> dict:
    """Periodic sweep (apps/worker's Celery beat, hourly -- see
    apps/worker/tasks.py's check_reorder_thresholds). maybe_open_purchase_
    required (app/routers/inventory.py) only runs reactively, inside
    create_stock_transaction and create_purchase -- an item whose stock was
    already below minimum_threshold before either of those ever ran against
    it (seeded data, a raw DB write, a future bulk-import path, or simply
    minimum_threshold being raised via update_inventory_item, which never
    touches stock at all) would otherwise never get flagged. This sweep
    closes that gap by checking every active item across every tenant, not
    just ones with a recent stock-changing event. Same
    tenant-loop-plus-SET-LOCAL pattern as
    internal_list_due_scheduled_reports, for the same reason: there's no
    single authenticated tenant to derive RLS context from on a
    machine-to-machine call. Idempotent -- maybe_open_purchase_required
    itself skips items that already have an open (non-"received",
    non-"rejected") request.
    """
    opened = 0
    for tenant in db.query(Tenant).all():
        set_tenant_context(db, str(tenant.id))
        items = db.query(InventoryItem).filter(InventoryItem.is_active.is_(True)).all()
        for item in items:
            before = (
                db.query(PurchaseRequired)
                .filter(
                    PurchaseRequired.inventory_item_id == item.id,
                    PurchaseRequired.status.not_in(PURCHASE_REQUIRED_CLOSED_STATUSES),
                )
                .count()
            )
            maybe_open_purchase_required(db, tenant.id, item)
            db.flush()
            after = (
                db.query(PurchaseRequired)
                .filter(
                    PurchaseRequired.inventory_item_id == item.id,
                    PurchaseRequired.status.not_in(PURCHASE_REQUIRED_CLOSED_STATUSES),
                )
                .count()
            )
            if after > before:
                opened += 1
        db.commit()
    return {"opened": opened}
