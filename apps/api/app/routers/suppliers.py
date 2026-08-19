import html as html_escape
import uuid
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Purchase, PurchaseLineItem, Supplier, SupplierPayment, User
from app.pdf import html_to_pdf
from app.permissions import user_has_permission
from app.schemas.supplier import (
    SupplierCreateRequest,
    SupplierDocsOut,
    SupplierOut,
    SupplierUpdateRequest,
    SupplierWithBalanceOut,
)
from app.schemas.supplier_ledger import SupplierLedgerEntryOut

router = APIRouter()

STATEMENT_PDF_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 2cm; }}
  body {{ font-family: sans-serif; font-size: 12px; color: #111; }}
  h1 {{ font-size: 20px; margin: 0 0 4px 0; }}
  .meta {{ margin-bottom: 24px; color: #444; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; }}
  th {{ background: #f3f3f3; }}
  td.num, th.num {{ text-align: right; }}
</style>
</head>
<body>
  <h1>Supplier Statement of Account</h1>
  <div class="meta"><strong>Supplier:</strong> {supplier_name}</div>
  <table>
    <thead>
      <tr><th>Date</th><th>Reference</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr>
    </thead>
    <tbody>
      {rows}
    </tbody>
  </table>
</body>
</html>"""


def _serialize(
    supplier: Supplier, can_see_money: bool, current_balance: float = 0.0
) -> SupplierOut | SupplierWithBalanceOut:
    if not can_see_money:
        return SupplierOut.model_validate(supplier)
    return SupplierWithBalanceOut(
        **SupplierOut.model_validate(supplier).model_dump(),
        opening_balance=supplier.opening_balance,
        current_balance=current_balance,
    )


def _current_balance(db: Session, supplier: Supplier) -> float:
    """Single-supplier version of the bulk computation in list_suppliers --
    opening_balance + purchase totals - payment amounts. Nets the full
    SupplierPayment.amount regardless of allocation_type breakdown, same as
    _build_ledger's payment movements below (matches Party's _build_ledger:
    a payment reduces what's owed overall, no matter which bucket its
    allocations landed in)."""
    purchase_total = (
        db.query(func.coalesce(func.sum(PurchaseLineItem.line_total), 0))
        .join(Purchase, PurchaseLineItem.purchase_id == Purchase.id)
        .filter(Purchase.supplier_id == supplier.id)
        .scalar()
    )
    payment_total = (
        db.query(func.coalesce(func.sum(SupplierPayment.amount), 0))
        .filter(SupplierPayment.supplier_id == supplier.id)
        .scalar()
    )
    return float(supplier.opening_balance) + float(purchase_total) - float(payment_total)


# NOTE: response_model is deliberately NOT set on any route below -- see
# _serialize()'s docstring. The `responses={...}` dicts are FastAPI's
# `responses=` parameter (distinct from response_model): purely additive
# OpenAPI documentation for codegen (orval) and Swagger UI, zero effect on
# runtime request/response handling.


@router.get("", responses={200: {"model": list[SupplierDocsOut]}}, operation_id="listSuppliers")
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

    can_see_money = user.is_super_admin or user_has_permission(db, user, "suppliers.see_money")

    balances: dict[uuid.UUID, float] = {}
    if can_see_money and rows:
        supplier_ids = [s.id for s in rows]
        # One grouped query for the whole page rather than a per-supplier
        # query (N+1) -- same tradeoff as list_parties.
        purchase_totals = dict(
            db.query(Purchase.supplier_id, func.coalesce(func.sum(PurchaseLineItem.line_total), 0))
            .join(PurchaseLineItem, PurchaseLineItem.purchase_id == Purchase.id)
            .filter(Purchase.supplier_id.in_(supplier_ids))
            .group_by(Purchase.supplier_id)
            .all()
        )
        payment_totals = dict(
            db.query(SupplierPayment.supplier_id, func.coalesce(func.sum(SupplierPayment.amount), 0))
            .filter(SupplierPayment.supplier_id.in_(supplier_ids))
            .group_by(SupplierPayment.supplier_id)
            .all()
        )
        balances = {
            s.id: float(s.opening_balance) + float(purchase_totals.get(s.id, 0)) - float(payment_totals.get(s.id, 0))
            for s in rows
        }

    return [_serialize(s, can_see_money, balances.get(s.id, float(s.opening_balance))) for s in rows]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    responses={201: {"model": SupplierDocsOut}},
    operation_id="createSupplier",
)
def create_supplier(
    payload: SupplierCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("suppliers.create")),
):
    supplier = Supplier(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(supplier)
    db.flush()  # populate supplier.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="supplier",
        entity_id=supplier.id,
        new_values=payload.model_dump(),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    # db.commit() ends the transaction that set_tenant_context() scoped its
    # SET LOCAL to -- re-establish it before the refresh below re-queries
    # suppliers under RLS. See app/db.py's set_tenant_context docstring.
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(supplier)

    # Brand new supplier, no purchases can exist yet -- current_balance is
    # trivially opening_balance, no need for _current_balance's query.
    can_see_money = user.is_super_admin or user_has_permission(db, user, "suppliers.see_money")
    return _serialize(supplier, can_see_money, float(supplier.opening_balance))


@router.get(
    "/{supplier_id}", responses={200: {"model": SupplierDocsOut}}, operation_id="getSupplier"
)
def get_supplier(
    supplier_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("suppliers.view")),
):
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="supplier_not_found")

    can_see_money = user.is_super_admin or user_has_permission(db, user, "suppliers.see_money")
    balance = _current_balance(db, supplier) if can_see_money else 0.0
    return _serialize(supplier, can_see_money, balance)


@router.patch(
    "/{supplier_id}", responses={200: {"model": SupplierDocsOut}}, operation_id="updateSupplier"
)
def update_supplier(
    supplier_id: uuid.UUID,
    payload: SupplierUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("suppliers.edit")),
):
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="supplier_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        current = getattr(supplier, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(supplier, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="supplier",
            entity_id=supplier.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(supplier)

    can_see_money = user.is_super_admin or user_has_permission(db, user, "suppliers.see_money")
    balance = _current_balance(db, supplier) if can_see_money else 0.0
    return _serialize(supplier, can_see_money, balance)


def _build_ledger(db: Session, supplier: Supplier) -> list[SupplierLedgerEntryOut]:
    """Computed live from Purchase (debit) and SupplierPayment (credit) rows
    plus Supplier.opening_balance -- see SupplierLedgerEntryOut's docstring
    for why this is never stored. Same shape as Party's _build_ledger:
    every movement (debit or credit) goes into one list sorted by date,
    then replayed in order to get a running balance."""
    purchases = db.query(Purchase).filter(Purchase.supplier_id == supplier.id).all()
    payments = db.query(SupplierPayment).filter(SupplierPayment.supplier_id == supplier.id).all()

    movements: list[tuple[date_type, str, str, str, float, float]] = []
    for purchase in purchases:
        total = (
            db.query(func.coalesce(func.sum(PurchaseLineItem.line_total), 0))
            .filter(PurchaseLineItem.purchase_id == purchase.id)
            .scalar()
        )
        movements.append(
            (
                purchase.purchase_date,
                "purchase",
                purchase.purchase_number,
                f"Purchase {purchase.purchase_number}",
                float(total),
                0.0,
            )
        )
    for payment in payments:
        movements.append(
            (
                payment.payment_date,
                "payment",
                payment.payment_number,
                f"Payment {payment.payment_number}",
                0.0,
                float(payment.amount),
            )
        )
    movements.sort(key=lambda m: m[0])

    balance = float(supplier.opening_balance)
    entries = [
        SupplierLedgerEntryOut(
            entry_date=movements[0][0] if movements else date_type.today(),
            entry_type="opening_balance",
            reference="Opening Balance",
            description="Opening Balance",
            debit=max(balance, 0.0),
            credit=max(-balance, 0.0),
            balance=balance,
        )
    ]
    for entry_date, entry_type, reference, description, debit, credit in movements:
        balance += debit - credit
        entries.append(
            SupplierLedgerEntryOut(
                entry_date=entry_date,
                entry_type=entry_type,  # type: ignore[arg-type]
                reference=reference,
                description=description,
                debit=debit,
                credit=credit,
                balance=round(balance, 2),
            )
        )
    return entries


@router.get(
    "/{supplier_id}/ledger", response_model=list[SupplierLedgerEntryOut], operation_id="getSupplierLedger"
)
def get_supplier_ledger(
    supplier_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("suppliers.see_money")),
) -> list[SupplierLedgerEntryOut]:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="supplier_not_found")
    return _build_ledger(db, supplier)


@router.get("/{supplier_id}/ledger/pdf", operation_id="getSupplierLedgerPdf")
def get_supplier_ledger_pdf(
    supplier_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("suppliers.see_money")),
) -> Response:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="supplier_not_found")
    entries = _build_ledger(db, supplier)

    rows_html = "".join(
        "<tr><td>{date}</td><td>{ref}</td><td>{desc}</td>"
        "<td class=\"num\">{debit}</td><td class=\"num\">{credit}</td><td class=\"num\">{balance}</td></tr>".format(
            date=entry.entry_date.isoformat(),
            ref=html_escape.escape(entry.reference),
            desc=html_escape.escape(entry.description),
            debit=f"{entry.debit:,.2f}" if entry.debit else "",
            credit=f"{entry.credit:,.2f}" if entry.credit else "",
            balance=f"{entry.balance:,.2f}",
        )
        for entry in entries
    )
    html_doc = STATEMENT_PDF_TEMPLATE.format(supplier_name=html_escape.escape(supplier.name), rows=rows_html)
    pdf_bytes = html_to_pdf(html_doc)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{supplier.name}-statement.pdf"'},
    )
