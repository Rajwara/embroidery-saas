import html as html_escape
import uuid
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Invoice, InvoiceLineItem, Party, Payment, User
from app.pdf import html_to_pdf
from app.permissions import user_has_permission
from app.schemas.party import (
    PartyCreateRequest,
    PartyDocsOut,
    PartyOut,
    PartyUpdateRequest,
    PartyWithBalanceOut,
)
from app.schemas.party_ledger import LedgerEntryOut

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
  <h1>Statement of Account</h1>
  <div class="meta"><strong>Party:</strong> {party_name}</div>
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


def _serialize(party: Party, can_see_money: bool) -> PartyOut | PartyWithBalanceOut:
    return (PartyWithBalanceOut if can_see_money else PartyOut).model_validate(party)


# NOTE: response_model is deliberately NOT set on any route below -- see
# _serialize()'s docstring. The `responses={...}` dicts are FastAPI's
# `responses=` parameter (distinct from response_model): purely additive
# OpenAPI documentation for codegen (orval) and Swagger UI, zero effect on
# runtime request/response handling.


@router.get("", responses={200: {"model": list[PartyDocsOut]}}, operation_id="listParties")
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


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    responses={201: {"model": PartyDocsOut}},
    operation_id="createParty",
)
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


@router.get("/{party_id}", responses={200: {"model": PartyDocsOut}}, operation_id="getParty")
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


@router.patch("/{party_id}", responses={200: {"model": PartyDocsOut}}, operation_id="updateParty")
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


def _build_ledger(db: Session, party: Party) -> list[LedgerEntryOut]:
    """Computed live from Invoice (debit) + Payment (credit) rows plus
    Party.opening_balance -- see LedgerEntryOut's docstring for why this
    is never stored."""
    invoices = db.query(Invoice).filter(Invoice.party_id == party.id).all()
    payments = db.query(Payment).filter(Payment.party_id == party.id).all()

    movements: list[tuple[date_type, str, str, str, float, float]] = []
    for invoice in invoices:
        total = (
            db.query(func.coalesce(func.sum(InvoiceLineItem.line_total), 0))
            .filter(InvoiceLineItem.invoice_id == invoice.id)
            .scalar()
        )
        movements.append(
            (invoice.invoice_date, "invoice", invoice.invoice_number, f"Invoice {invoice.invoice_number}", float(total), 0.0)
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

    balance = float(party.opening_balance)
    entries = [
        LedgerEntryOut(
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
            LedgerEntryOut(
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
    "/{party_id}/ledger", response_model=list[LedgerEntryOut], operation_id="getPartyLedger"
)
def get_party_ledger(
    party_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("parties.see_money")),
) -> list[LedgerEntryOut]:
    party = db.get(Party, party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="party_not_found")
    return _build_ledger(db, party)


@router.get("/{party_id}/ledger/pdf", operation_id="getPartyLedgerPdf")
def get_party_ledger_pdf(
    party_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("parties.see_money")),
) -> Response:
    party = db.get(Party, party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="party_not_found")
    entries = _build_ledger(db, party)

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
    html_doc = STATEMENT_PDF_TEMPLATE.format(party_name=html_escape.escape(party.name), rows=rows_html)
    pdf_bytes = html_to_pdf(html_doc)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{party.name}-statement.pdf"'},
    )
