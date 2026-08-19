import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import (
    Branch,
    Factory,
    Purchase,
    PurchaseLineItem,
    Supplier,
    SupplierPayment,
    SupplierPaymentAllocation,
    User,
)
from app.pricing import allocation_within_balance, allocations_sum_matches_amount
from app.schemas.supplier_payment import (
    PurchaseBalanceOut,
    SupplierPaymentAllocationCreateRequest,
    SupplierPaymentAllocationOut,
    SupplierPaymentCreateRequest,
    SupplierPaymentDetailOut,
    SupplierPaymentOut,
)

router = APIRouter()


def _purchase_total(db: Session, purchase_id: uuid.UUID) -> float:
    total = (
        db.query(func.coalesce(func.sum(PurchaseLineItem.line_total), 0))
        .filter(PurchaseLineItem.purchase_id == purchase_id)
        .scalar()
    )
    return float(total)


def _purchase_paid_amount(db: Session, purchase_id: uuid.UUID) -> float:
    paid = (
        db.query(func.coalesce(func.sum(SupplierPaymentAllocation.amount), 0))
        .filter(
            SupplierPaymentAllocation.purchase_id == purchase_id,
            SupplierPaymentAllocation.allocation_type == "purchase",
        )
        .scalar()
    )
    return float(paid)


def _allocation_out(db: Session, allocation: SupplierPaymentAllocation) -> SupplierPaymentAllocationOut:
    purchase_number = None
    if allocation.purchase_id is not None:
        purchase = db.get(Purchase, allocation.purchase_id)
        purchase_number = purchase.purchase_number if purchase else None
    return SupplierPaymentAllocationOut(
        id=allocation.id,
        supplier_payment_id=allocation.supplier_payment_id,
        allocation_type=allocation.allocation_type,
        purchase_id=allocation.purchase_id,
        amount=float(allocation.amount),
        purchase_number=purchase_number,
    )


def _build_payment_detail(db: Session, payment: SupplierPayment) -> SupplierPaymentDetailOut:
    """Manually assembles the nested allocations -- SupplierPayment carries
    no ORM relationships (same FK-columns-only convention as Payment), so
    response_model can't derive this automatically from attribute access."""
    allocations = (
        db.query(SupplierPaymentAllocation)
        .filter(SupplierPaymentAllocation.supplier_payment_id == payment.id)
        .order_by(SupplierPaymentAllocation.created_at)
        .all()
    )
    return SupplierPaymentDetailOut(
        id=payment.id,
        branch_id=payment.branch_id,
        supplier_id=payment.supplier_id,
        payment_number=payment.payment_number,
        payment_date=payment.payment_date,
        amount=float(payment.amount),
        payment_method=payment.payment_method,
        notes=payment.notes,
        allocations=[_allocation_out(db, a) for a in allocations],
    )


def _validate_allocation(
    db: Session, supplier_id: uuid.UUID, payload: SupplierPaymentAllocationCreateRequest
) -> None:
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="allocation_amount_must_be_positive")

    if payload.allocation_type == "purchase":
        if payload.purchase_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="purchase_id_required")
        purchase = db.get(Purchase, payload.purchase_id)
        if purchase is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="purchase_not_found")
        if purchase.supplier_id != supplier_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="purchase_supplier_mismatch")
        total = _purchase_total(db, purchase.id)
        already_paid = _purchase_paid_amount(db, purchase.id)
        if not allocation_within_balance(total, already_paid, payload.amount):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="allocation_exceeds_purchase_balance")
    elif payload.purchase_id is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="purchase_id_not_allowed")


@router.get("/purchase-balances", response_model=list[PurchaseBalanceOut], operation_id="getPurchaseBalances")
def get_purchase_balances(
    supplier_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("supplier_payments.view")),
) -> list[PurchaseBalanceOut]:
    purchases = db.query(Purchase).filter(Purchase.supplier_id == supplier_id).all()
    rows = []
    for purchase in purchases:
        total = _purchase_total(db, purchase.id)
        paid = _purchase_paid_amount(db, purchase.id)
        rows.append(
            PurchaseBalanceOut(
                purchase_id=purchase.id,
                purchase_number=purchase.purchase_number,
                total_amount=total,
                paid_amount=paid,
                balance=round(total - paid, 2),
            )
        )
    return rows


@router.get("", response_model=list[SupplierPaymentOut], operation_id="listSupplierPayments")
def list_supplier_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    supplier_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("supplier_payments.view")),
) -> list[SupplierPayment]:
    query = db.query(SupplierPayment)
    if supplier_id:
        query = query.filter(SupplierPayment.supplier_id == supplier_id)
    return query.order_by(SupplierPayment.payment_number.desc()).offset(skip).limit(limit).all()


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=SupplierPaymentDetailOut,
    operation_id="createSupplierPayment",
)
def create_supplier_payment(
    payload: SupplierPaymentCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("supplier_payments.create")),
) -> SupplierPaymentDetailOut:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")
    supplier = db.get(Supplier, payload.supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="supplier_not_found")
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="amount_must_be_positive")
    if not payload.allocations:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="no_allocations")

    if not allocations_sum_matches_amount([a.amount for a in payload.allocations], payload.amount):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="allocations_must_sum_to_amount")

    for allocation_payload in payload.allocations:
        _validate_allocation(db, supplier.id, allocation_payload)

    # Locked for the rest of this transaction -- serializes concurrent
    # create_supplier_payment calls so two requests can never be assigned
    # the same payment_number (same pattern as create_payment).
    factory = db.query(Factory).with_for_update().first()
    if factory is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="factory_not_found")
    payment_number = f"{factory.supplier_payment_number_prefix}-{factory.next_supplier_payment_number:06d}"
    factory.next_supplier_payment_number += 1

    payment = SupplierPayment(
        tenant_id=user.tenant_id,
        branch_id=branch.id,
        supplier_id=supplier.id,
        payment_number=payment_number,
        payment_date=payload.payment_date,
        amount=payload.amount,
        payment_method=payload.payment_method,
        notes=payload.notes,
    )
    db.add(payment)
    db.flush()  # populate payment.id -- Python-side default, not set until flush

    for allocation_payload in payload.allocations:
        db.add(
            SupplierPaymentAllocation(
                tenant_id=user.tenant_id,
                supplier_payment_id=payment.id,
                allocation_type=allocation_payload.allocation_type,
                purchase_id=allocation_payload.purchase_id,
                amount=allocation_payload.amount,
            )
        )

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="supplier_payment",
        entity_id=payment.id,
        new_values={
            "payment_number": payment_number,
            "supplier_id": str(supplier.id),
            "amount": str(payload.amount),
            "allocations": [
                {
                    "allocation_type": a.allocation_type,
                    "purchase_id": str(a.purchase_id) if a.purchase_id else None,
                    "amount": a.amount,
                }
                for a in payload.allocations
            ],
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(payment)
    return _build_payment_detail(db, payment)


@router.get("/{payment_id}", response_model=SupplierPaymentDetailOut, operation_id="getSupplierPayment")
def get_supplier_payment(
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("supplier_payments.view")),
) -> SupplierPaymentDetailOut:
    payment = db.get(SupplierPayment, payment_id)
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="supplier_payment_not_found")
    return _build_payment_detail(db, payment)
