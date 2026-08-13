import html as html_escape
import uuid
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Purchase, PurchaseLineItem, Supplier, User
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


def _serialize(supplier: Supplier, can_see_money: bool) -> SupplierOut | SupplierWithBalanceOut:
    return (SupplierWithBalanceOut if can_see_money else SupplierOut).model_validate(supplier)


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

    can_see_money = user_has_permission(db, user, "suppliers.see_money")
    return [_serialize(s, can_see_money) for s in rows]


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

    can_see_money = user_has_permission(db, user, "suppliers.see_money")
    return _serialize(supplier, can_see_money)


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

    can_see_money = user_has_permission(db, user, "suppliers.see_money")
    return _serialize(supplier, can_see_money)


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

    can_see_money = user_has_permission(db, user, "suppliers.see_money")
    return _serialize(supplier, can_see_money)


def _build_ledger(db: Session, supplier: Supplier) -> list[SupplierLedgerEntryOut]:
    """Computed live from Purchase rows plus Supplier.opening_balance --
    see SupplierLedgerEntryOut's docstring for why this is never stored,
    and why there's no credit-side (payment-to-supplier) movement yet."""
    purchases = db.query(Purchase).filter(Purchase.supplier_id == supplier.id).all()

    movements: list[tuple[date_type, str, str, float]] = []
    for purchase in purchases:
        total = (
            db.query(func.coalesce(func.sum(PurchaseLineItem.line_total), 0))
            .filter(PurchaseLineItem.purchase_id == purchase.id)
            .scalar()
        )
        movements.append(
            (purchase.purchase_date, purchase.purchase_number, f"Purchase {purchase.purchase_number}", float(total))
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
    for entry_date, reference, description, debit in movements:
        balance += debit
        entries.append(
            SupplierLedgerEntryOut(
                entry_date=entry_date,
                entry_type="purchase",
                reference=reference,
                description=description,
                debit=debit,
                credit=0.0,
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
