import html as html_escape
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Branch, DesignVariant, Factory, Invoice, InvoiceLineItem, Party, User
from app.pdf import html_to_pdf
from app.schemas.invoice import (
    InvoiceCreateRequest,
    InvoiceDetailOut,
    InvoiceLineItemCreateRequest,
    InvoiceLineItemOut,
    InvoiceOut,
)

router = APIRouter()

PRICING_TYPE_LABELS = {"per_suit": "Per suit", "stitch_based": "Stitch-based"}

INVOICE_PDF_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 2cm; }}
  body {{ font-family: sans-serif; font-size: 12px; color: #111; }}
  h1 {{ font-size: 20px; margin: 0 0 4px 0; }}
  .meta {{ margin-bottom: 24px; color: #444; line-height: 1.6; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; }}
  th {{ background: #f3f3f3; }}
  td.num, th.num {{ text-align: right; }}
  .totals {{ margin-top: 12px; font-weight: bold; text-align: right; font-size: 14px; }}
</style>
</head>
<body>
  <h1>Invoice {invoice_number}</h1>
  <div class="meta">
    <div><strong>Date:</strong> {invoice_date}</div>
    {due_date_html}
    <div><strong>Bill to:</strong> {party_name}</div>
    <div><strong>Branch:</strong> {branch_name}</div>
    {notes_html}
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th><th>Pricing</th><th class="num">Qty</th><th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>
      {rows}
    </tbody>
  </table>
  <div class="totals">Total: {total_amount}</div>
</body>
</html>"""


def _invoice_total(db: Session, invoice_id: uuid.UUID) -> float:
    total = (
        db.query(func.coalesce(func.sum(InvoiceLineItem.line_total), 0))
        .filter(InvoiceLineItem.invoice_id == invoice_id)
        .scalar()
    )
    return float(total)


def _to_invoice_out(invoice: Invoice, total_amount: float) -> InvoiceOut:
    return InvoiceOut(
        id=invoice.id,
        branch_id=invoice.branch_id,
        party_id=invoice.party_id,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        due_date=invoice.due_date,
        notes=invoice.notes,
        total_amount=total_amount,
    )


def _build_invoice_detail(db: Session, invoice: Invoice) -> InvoiceDetailOut:
    """Manually assembles the nested lines -- Invoice carries no ORM
    relationships (same FK-columns-only convention as Lot/LotColour), so
    response_model can't derive this automatically from attribute access."""
    lines = (
        db.query(InvoiceLineItem)
        .filter(InvoiceLineItem.invoice_id == invoice.id)
        .order_by(InvoiceLineItem.created_at)
        .all()
    )
    total_amount = sum(float(line.line_total) for line in lines)
    return InvoiceDetailOut(
        **_to_invoice_out(invoice, total_amount).model_dump(),
        lines=[InvoiceLineItemOut.model_validate(line) for line in lines],
    )


def _build_line_item(
    db: Session, tenant_id: uuid.UUID, payload: InvoiceLineItemCreateRequest
) -> InvoiceLineItem:
    if payload.quantity <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="quantity_must_be_positive")

    if payload.pricing_type == "per_suit":
        if payload.unit_price is None or payload.unit_price <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="unit_price_required")
        line_total = round(payload.quantity * payload.unit_price, 2)
        return InvoiceLineItem(
            tenant_id=tenant_id,
            description=payload.description,
            pricing_type=payload.pricing_type,
            quantity=payload.quantity,
            unit_price=payload.unit_price,
            line_total=line_total,
        )

    # stitch_based -- line_total = quantity * stitch_count *
    # rate_per_thousand_stitches / 1000 (see InvoiceLineItem's docstring).
    if payload.design_variant_id is None or payload.rate_per_thousand_stitches is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="design_variant_and_rate_required")
    if payload.rate_per_thousand_stitches <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="rate_must_be_positive")

    variant = db.get(DesignVariant, payload.design_variant_id)
    if variant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="design_variant_not_found")
    if variant.stitch_count is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="design_variant_stitch_count_not_set")

    line_total = round(payload.quantity * variant.stitch_count * payload.rate_per_thousand_stitches / 1000, 2)
    return InvoiceLineItem(
        tenant_id=tenant_id,
        description=payload.description,
        pricing_type=payload.pricing_type,
        quantity=payload.quantity,
        design_variant_id=variant.id,
        stitch_count=variant.stitch_count,
        rate_per_thousand_stitches=payload.rate_per_thousand_stitches,
        line_total=line_total,
    )


@router.get("", response_model=list[InvoiceOut], operation_id="listInvoices")
def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    party_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("invoices.view")),
) -> list[InvoiceOut]:
    query = db.query(Invoice)
    if party_id:
        query = query.filter(Invoice.party_id == party_id)
    invoices = query.order_by(Invoice.invoice_number.desc()).offset(skip).limit(limit).all()
    return [_to_invoice_out(invoice, _invoice_total(db, invoice.id)) for invoice in invoices]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=InvoiceDetailOut, operation_id="createInvoice")
def create_invoice(
    payload: InvoiceCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("invoices.create")),
) -> InvoiceDetailOut:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")
    party = db.get(Party, payload.party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="party_not_found")
    if not payload.lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="no_lines")

    # Locked for the rest of this transaction -- serializes concurrent
    # create_invoice calls so two requests can never be assigned the same
    # invoice_number (same pattern as create_lot).
    factory = db.query(Factory).with_for_update().first()
    if factory is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="factory_not_found")
    invoice_number = f"{factory.invoice_number_prefix}-{factory.next_invoice_number:06d}"
    factory.next_invoice_number += 1

    invoice = Invoice(
        tenant_id=user.tenant_id,
        branch_id=branch.id,
        party_id=party.id,
        invoice_number=invoice_number,
        invoice_date=payload.invoice_date,
        due_date=payload.due_date,
        notes=payload.notes,
    )
    db.add(invoice)
    db.flush()  # populate invoice.id -- Python-side default, not set until flush

    lines: list[InvoiceLineItem] = []
    for line_payload in payload.lines:
        line = _build_line_item(db, user.tenant_id, line_payload)
        line.invoice_id = invoice.id
        db.add(line)
        lines.append(line)

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="invoice",
        entity_id=invoice.id,
        new_values={
            "invoice_number": invoice_number,
            "party_id": str(party.id),
            "total_amount": str(sum(float(line.line_total) for line in lines)),
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(invoice)
    return _build_invoice_detail(db, invoice)


@router.get("/{invoice_id}", response_model=InvoiceDetailOut, operation_id="getInvoice")
def get_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("invoices.view")),
) -> InvoiceDetailOut:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="invoice_not_found")
    return _build_invoice_detail(db, invoice)


@router.get("/{invoice_id}/pdf", operation_id="getInvoicePdf")
def get_invoice_pdf(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("invoices.view")),
) -> Response:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="invoice_not_found")
    detail = _build_invoice_detail(db, invoice)
    party = db.get(Party, invoice.party_id)
    branch = db.get(Branch, invoice.branch_id)

    rows_html = "".join(
        "<tr><td>{desc}</td><td>{pricing}</td><td class=\"num\">{qty}</td><td class=\"num\">{amount}</td></tr>".format(
            desc=html_escape.escape(line.description),
            pricing=PRICING_TYPE_LABELS.get(line.pricing_type, line.pricing_type),
            qty=line.quantity,
            amount=f"{line.line_total:,.2f}",
        )
        for line in detail.lines
    )
    due_date_html = f"<div><strong>Due:</strong> {invoice.due_date.isoformat()}</div>" if invoice.due_date else ""
    notes_html = f"<div><strong>Notes:</strong> {html_escape.escape(invoice.notes)}</div>" if invoice.notes else ""

    html_doc = INVOICE_PDF_TEMPLATE.format(
        invoice_number=html_escape.escape(invoice.invoice_number),
        invoice_date=invoice.invoice_date.isoformat(),
        due_date_html=due_date_html,
        party_name=html_escape.escape(party.name),
        branch_name=html_escape.escape(branch.name),
        notes_html=notes_html,
        rows=rows_html,
        total_amount=f"{detail.total_amount:,.2f}",
    )
    pdf_bytes = html_to_pdf(html_doc)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{invoice.invoice_number}.pdf"'},
    )
