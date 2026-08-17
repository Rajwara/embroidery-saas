import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Branch, Factory, Invoice, InvoiceLineItem, Party, Payment, PaymentAllocation, User
from app.schemas.payment import (
    InvoiceBalanceOut,
    PaymentAllocationCreateRequest,
    PaymentAllocationOut,
    PaymentCreateRequest,
    PaymentDetailOut,
    PaymentOut,
)

router = APIRouter()


def _invoice_total(db: Session, invoice_id: uuid.UUID) -> float:
    total = (
        db.query(func.coalesce(func.sum(InvoiceLineItem.line_total), 0))
        .filter(InvoiceLineItem.invoice_id == invoice_id)
        .scalar()
    )
    return float(total)


def _invoice_paid_amount(db: Session, invoice_id: uuid.UUID) -> float:
    paid = (
        db.query(func.coalesce(func.sum(PaymentAllocation.amount), 0))
        .filter(PaymentAllocation.invoice_id == invoice_id, PaymentAllocation.allocation_type == "invoice")
        .scalar()
    )
    return float(paid)


def _allocation_out(db: Session, allocation: PaymentAllocation) -> PaymentAllocationOut:
    invoice_number = None
    if allocation.invoice_id is not None:
        invoice = db.get(Invoice, allocation.invoice_id)
        invoice_number = invoice.invoice_number if invoice else None
    return PaymentAllocationOut(
        id=allocation.id,
        payment_id=allocation.payment_id,
        allocation_type=allocation.allocation_type,
        invoice_id=allocation.invoice_id,
        amount=float(allocation.amount),
        invoice_number=invoice_number,
    )


def _build_payment_detail(db: Session, payment: Payment) -> PaymentDetailOut:
    """Manually assembles the nested allocations -- Payment carries no ORM
    relationships (same FK-columns-only convention as Lot/LotColour), so
    response_model can't derive this automatically from attribute access."""
    allocations = (
        db.query(PaymentAllocation)
        .filter(PaymentAllocation.payment_id == payment.id)
        .order_by(PaymentAllocation.created_at)
        .all()
    )
    return PaymentDetailOut(
        id=payment.id,
        branch_id=payment.branch_id,
        party_id=payment.party_id,
        payment_number=payment.payment_number,
        payment_date=payment.payment_date,
        amount=float(payment.amount),
        payment_method=payment.payment_method,
        notes=payment.notes,
        allocations=[_allocation_out(db, a) for a in allocations],
    )


def _validate_allocation(
    db: Session, party_id: uuid.UUID, payload: PaymentAllocationCreateRequest
) -> None:
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="allocation_amount_must_be_positive")

    if payload.allocation_type == "invoice":
        if payload.invoice_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invoice_id_required")
        invoice = db.get(Invoice, payload.invoice_id)
        if invoice is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="invoice_not_found")
        if invoice.party_id != party_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invoice_party_mismatch")
        total = _invoice_total(db, invoice.id)
        already_paid = _invoice_paid_amount(db, invoice.id)
        if already_paid + payload.amount > total:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="allocation_exceeds_invoice_balance")
    elif payload.invoice_id is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invoice_id_not_allowed")


@router.get("/invoice-balances", response_model=list[InvoiceBalanceOut], operation_id="getInvoiceBalances")
def get_invoice_balances(
    party_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("payments.view")),
) -> list[InvoiceBalanceOut]:
    invoices = db.query(Invoice).filter(Invoice.party_id == party_id).all()
    rows = []
    for invoice in invoices:
        total = _invoice_total(db, invoice.id)
        paid = _invoice_paid_amount(db, invoice.id)
        rows.append(
            InvoiceBalanceOut(
                invoice_id=invoice.id,
                invoice_number=invoice.invoice_number,
                total_amount=total,
                paid_amount=paid,
                balance=round(total - paid, 2),
            )
        )
    return rows


@router.get("", response_model=list[PaymentOut], operation_id="listPayments")
def list_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    party_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("payments.view")),
) -> list[Payment]:
    query = db.query(Payment)
    if party_id:
        query = query.filter(Payment.party_id == party_id)
    return query.order_by(Payment.payment_number.desc()).offset(skip).limit(limit).all()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=PaymentDetailOut, operation_id="createPayment")
def create_payment(
    payload: PaymentCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("payments.create")),
) -> PaymentDetailOut:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")
    party = db.get(Party, payload.party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="party_not_found")
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="amount_must_be_positive")
    if not payload.allocations:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="no_allocations")

    allocations_sum = round(sum(a.amount for a in payload.allocations), 2)
    if allocations_sum != round(payload.amount, 2):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="allocations_must_sum_to_amount")

    for allocation_payload in payload.allocations:
        _validate_allocation(db, party.id, allocation_payload)

    # Locked for the rest of this transaction -- serializes concurrent
    # create_payment calls so two requests can never be assigned the same
    # payment_number (same pattern as create_lot).
    factory = db.query(Factory).with_for_update().first()
    if factory is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="factory_not_found")
    payment_number = f"{factory.payment_number_prefix}-{factory.next_payment_number:06d}"
    factory.next_payment_number += 1

    payment = Payment(
        tenant_id=user.tenant_id,
        branch_id=branch.id,
        party_id=party.id,
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
            PaymentAllocation(
                tenant_id=user.tenant_id,
                payment_id=payment.id,
                allocation_type=allocation_payload.allocation_type,
                invoice_id=allocation_payload.invoice_id,
                amount=allocation_payload.amount,
            )
        )

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="payment",
        entity_id=payment.id,
        new_values={
            "payment_number": payment_number,
            "party_id": str(party.id),
            "amount": str(payload.amount),
            "allocations": [
                {"allocation_type": a.allocation_type, "invoice_id": str(a.invoice_id) if a.invoice_id else None, "amount": a.amount}
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


@router.get("/{payment_id}", response_model=PaymentDetailOut, operation_id="getPayment")
def get_payment(
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("payments.view")),
) -> PaymentDetailOut:
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="payment_not_found")
    return _build_payment_detail(db, payment)
