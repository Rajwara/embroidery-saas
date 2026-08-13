import html as html_escape
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import (
    Branch,
    DeliveryChallan,
    DeliveryChallanLine,
    Factory,
    Lot,
    LotColour,
    LotComponent,
    MachineProductionEntry,
    Party,
    ProductionJob,
    ProductionJobComponent,
    ProductionJobMachineAllocation,
    User,
)
from app.pdf import html_to_pdf
from app.schemas.delivery_challan import (
    DeliveryChallanCreateRequest,
    DeliveryChallanDetailOut,
    DeliveryChallanLineOut,
    DeliveryChallanOut,
    ReconciliationRow,
)

router = APIRouter()

UNIT_TYPE_LABELS = {"shirt": "Shirt", "dupatta": "Dupatta", "trouser": "Trouser"}

CHALLAN_PDF_TEMPLATE = """<!DOCTYPE html>
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
  .totals {{ margin-top: 12px; font-weight: bold; text-align: right; }}
</style>
</head>
<body>
  <h1>Delivery Challan {challan_number}</h1>
  <div class="meta">
    <div><strong>Date:</strong> {delivery_date}</div>
    <div><strong>To:</strong> {party_name}</div>
    <div><strong>Branch:</strong> {branch_name}</div>
    {notes_html}
  </div>
  <table>
    <thead><tr><th>Lot #</th><th>Colour</th><th>Unit</th><th>Quantity</th></tr></thead>
    <tbody>
      {rows}
    </tbody>
  </table>
  <div class="totals">Total pieces: {total_quantity}</div>
</body>
</html>"""

# unit_type -> the LotComponent/ProductionJobComponent component_types it's
# made of. "shirt" is a 3-way roll-up (see [[domain_production_job]]
# memory); dupatta/trouser are themselves. Applicable unit_types for a
# colour are whichever of these have every underlying component_type
# present (dupatta/trouser only exist for some suit_types).
UNIT_COMPONENTS: dict[str, tuple[str, ...]] = {
    "shirt": ("front", "back", "sleeves"),
    "dupatta": ("dupatta",),
    "trouser": ("trouser",),
}


def _approved_quantity_for_component(db: Session, production_job_id: uuid.UUID | None, component_type: str) -> int:
    if production_job_id is None:
        return 0
    component = (
        db.query(ProductionJobComponent)
        .filter(
            ProductionJobComponent.production_job_id == production_job_id,
            ProductionJobComponent.component_type == component_type,
        )
        .first()
    )
    if component is None:
        return 0
    return (
        db.query(func.coalesce(func.sum(MachineProductionEntry.quantity), 0))
        .join(
            ProductionJobMachineAllocation,
            MachineProductionEntry.production_job_machine_allocation_id == ProductionJobMachineAllocation.id,
        )
        .filter(
            ProductionJobMachineAllocation.production_job_component_id == component.id,
            MachineProductionEntry.status == "approved",
        )
        .scalar()
    )


def _reconciliation_for_colour(db: Session, colour: LotColour, lot: Lot) -> list[ReconciliationRow]:
    components = {
        c.component_type: c
        for c in db.query(LotComponent).filter(LotComponent.lot_colour_id == colour.id).all()
    }
    job = db.query(ProductionJob).filter(ProductionJob.lot_colour_id == colour.id).first()
    job_id = job.id if job else None

    rows = []
    for unit_type, component_types in UNIT_COMPONENTS.items():
        if not all(ct in components for ct in component_types):
            continue

        received = min((components[ct].confirmed_quantity or 0) for ct in component_types)
        approved_produced = min(_approved_quantity_for_component(db, job_id, ct) for ct in component_types)
        delivered = (
            db.query(func.coalesce(func.sum(DeliveryChallanLine.quantity), 0))
            .filter(DeliveryChallanLine.lot_colour_id == colour.id, DeliveryChallanLine.unit_type == unit_type)
            .scalar()
        )
        available = min(received, approved_produced)
        rows.append(
            ReconciliationRow(
                lot_colour_id=colour.id,
                lot_id=lot.id,
                lot_number=lot.lot_number,
                colour_name=colour.colour_name,
                unit_type=unit_type,
                received=received,
                approved_produced=approved_produced,
                delivered=delivered,
                remaining=max(0, available - delivered),
            )
        )
    return rows


def _line_out(line: DeliveryChallanLine, lot: Lot, colour: LotColour) -> DeliveryChallanLineOut:
    return DeliveryChallanLineOut(
        id=line.id,
        delivery_challan_id=line.delivery_challan_id,
        lot_colour_id=line.lot_colour_id,
        unit_type=line.unit_type,
        quantity=line.quantity,
        lot_id=lot.id,
        lot_number=lot.lot_number,
        colour_name=colour.colour_name,
    )


def _build_challan_detail(db: Session, challan: DeliveryChallan) -> DeliveryChallanDetailOut:
    """Manually assembles the nested lines -- DeliveryChallan carries no
    ORM relationships (same FK-columns-only convention as Lot/LotColour),
    so response_model can't derive this automatically from attribute
    access."""
    lines = (
        db.query(DeliveryChallanLine)
        .filter(DeliveryChallanLine.delivery_challan_id == challan.id)
        .order_by(DeliveryChallanLine.created_at)
        .all()
    )
    line_outs = []
    for line in lines:
        colour = db.get(LotColour, line.lot_colour_id)
        lot = db.get(Lot, colour.lot_id)
        line_outs.append(_line_out(line, lot, colour))
    return DeliveryChallanDetailOut(
        **DeliveryChallanOut.model_validate(challan).model_dump(), lines=line_outs
    )


@router.get("/reconciliation", response_model=list[ReconciliationRow], operation_id="getDeliveryReconciliation")
def get_delivery_reconciliation(
    party_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("delivery_challans.view")),
) -> list[ReconciliationRow]:
    lots = db.query(Lot).filter(Lot.party_id == party_id, Lot.status == "confirmed").all()
    rows: list[ReconciliationRow] = []
    for lot in lots:
        colours = db.query(LotColour).filter(LotColour.lot_id == lot.id).all()
        for colour in colours:
            rows.extend(_reconciliation_for_colour(db, colour, lot))
    return rows


@router.get("", response_model=list[DeliveryChallanOut], operation_id="listDeliveryChallans")
def list_delivery_challans(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    party_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("delivery_challans.view")),
) -> list[DeliveryChallan]:
    query = db.query(DeliveryChallan)
    if party_id:
        query = query.filter(DeliveryChallan.party_id == party_id)
    return query.order_by(DeliveryChallan.challan_number.desc()).offset(skip).limit(limit).all()


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=DeliveryChallanDetailOut,
    operation_id="createDeliveryChallan",
)
def create_delivery_challan(
    payload: DeliveryChallanCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delivery_challans.create")),
) -> DeliveryChallanDetailOut:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")
    party = db.get(Party, payload.party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="party_not_found")
    if not payload.lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="no_lines")

    # Locked for the rest of this transaction -- serializes concurrent
    # create_delivery_challan calls so two requests can never be assigned
    # the same challan_number (same pattern as create_lot).
    factory = db.query(Factory).with_for_update().first()
    if factory is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="factory_not_found")
    challan_number = f"CH-{factory.next_challan_number:06d}"
    factory.next_challan_number += 1

    challan = DeliveryChallan(
        tenant_id=user.tenant_id,
        branch_id=branch.id,
        party_id=party.id,
        challan_number=challan_number,
        delivery_date=payload.delivery_date,
        notes=payload.notes,
    )
    db.add(challan)
    db.flush()  # populate challan.id -- Python-side default, not set until flush

    # Aggregate requested quantities per (lot_colour_id, unit_type) first --
    # if the same pair appears on more than one line in this submission,
    # the cap check needs to see their combined total, not validate each
    # line independently against the same remaining capacity.
    requested: dict[tuple[uuid.UUID, str], int] = {}
    for line in payload.lines:
        key = (line.lot_colour_id, line.unit_type)
        requested[key] = requested.get(key, 0) + line.quantity

    for (lot_colour_id, unit_type), total_quantity in requested.items():
        colour = db.get(LotColour, lot_colour_id)
        if colour is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="lot_colour_not_found")
        lot = db.get(Lot, colour.lot_id)
        if lot is None or lot.status != "confirmed":
            raise HTTPException(status.HTTP_409_CONFLICT, detail="lot_not_confirmed")
        if lot.party_id != party.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="lot_colour_party_mismatch")

        reconciliation = {row.unit_type: row for row in _reconciliation_for_colour(db, colour, lot)}
        row = reconciliation.get(unit_type)
        if row is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="unit_type_not_applicable")
        if total_quantity > row.remaining:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="quantity_exceeds_remaining")

    for line in payload.lines:
        db.add(
            DeliveryChallanLine(
                tenant_id=user.tenant_id,
                delivery_challan_id=challan.id,
                lot_colour_id=line.lot_colour_id,
                unit_type=line.unit_type,
                quantity=line.quantity,
            )
        )

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="delivery_challan",
        entity_id=challan.id,
        new_values={
            "challan_number": challan_number,
            "party_id": str(party.id),
            "lines": [
                {"lot_colour_id": str(line.lot_colour_id), "unit_type": line.unit_type, "quantity": line.quantity}
                for line in payload.lines
            ],
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(challan)
    return _build_challan_detail(db, challan)


@router.get("/{challan_id}", response_model=DeliveryChallanDetailOut, operation_id="getDeliveryChallan")
def get_delivery_challan(
    challan_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("delivery_challans.view")),
) -> DeliveryChallanDetailOut:
    challan = db.get(DeliveryChallan, challan_id)
    if challan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="challan_not_found")
    return _build_challan_detail(db, challan)


@router.get("/{challan_id}/pdf", operation_id="getDeliveryChallanPdf")
def get_delivery_challan_pdf(
    challan_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("delivery_challans.view")),
) -> Response:
    challan = db.get(DeliveryChallan, challan_id)
    if challan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="challan_not_found")
    detail = _build_challan_detail(db, challan)
    party = db.get(Party, challan.party_id)
    branch = db.get(Branch, challan.branch_id)

    # Escaped -- party/branch names and colour_name are free-text tenant
    # data, not trusted markup (see Party/LotColour model docstrings).
    rows_html = "".join(
        "<tr><td>{lot}</td><td>{colour}</td><td>{unit}</td><td>{qty}</td></tr>".format(
            lot=html_escape.escape(line.lot_number),
            colour=html_escape.escape(line.colour_name),
            unit=UNIT_TYPE_LABELS.get(line.unit_type, line.unit_type),
            qty=line.quantity,
        )
        for line in detail.lines
    )
    total_quantity = sum(line.quantity for line in detail.lines)
    notes_html = (
        f"<div><strong>Notes:</strong> {html_escape.escape(challan.notes)}</div>" if challan.notes else ""
    )

    html_doc = CHALLAN_PDF_TEMPLATE.format(
        challan_number=html_escape.escape(challan.challan_number),
        delivery_date=challan.delivery_date.isoformat(),
        party_name=html_escape.escape(party.name),
        branch_name=html_escape.escape(branch.name),
        notes_html=notes_html,
        rows=rows_html,
        total_quantity=total_quantity,
    )
    pdf_bytes = html_to_pdf(html_doc)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{challan.challan_number}.pdf"'},
    )
