import html as html_escape
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import (
    AuditLog,
    Branch,
    Design,
    Employee,
    Lot,
    LotColour,
    Machine,
    MachineProductionEntry,
    Party,
    ProductionJob,
    ProductionJobComponent,
    ProductionJobMachineAllocation,
    User,
)
from app.pdf import html_to_pdf
from app.schemas.machine import (
    MachineAllocationOut,
    MachineAssignmentRequest,
    MachineCreateRequest,
    MachineOut,
    MachineStatusHistoryOut,
    MachineStatusOut,
    MachineUpdateRequest,
)

router = APIRouter()

SHIFT_LABELS = {"morning": "Morning", "evening": "Evening", "night": "Night"}

MACHINE_STATUS_PDF_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 2cm; }}
  body {{ font-family: sans-serif; font-size: 12px; color: #111; }}
  h1 {{ font-size: 20px; margin: 0 0 4px 0; }}
  .meta {{ margin-bottom: 4px; color: #444; }}
  .status {{ display: inline-block; margin: 8px 0; padding: 3px 10px; border-radius: 10px; background: #f0f0f0; font-size: 11px; text-transform: capitalize; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; }}
  th {{ background: #f3f3f3; width: 35%; }}
</style>
</head>
<body>
  <h1>Machine Status: {code}</h1>
  <div class="meta"><strong>Name:</strong> {name}</div>
  <div class="meta"><strong>Type:</strong> {machine_type} &middot; <strong>Brand/Model:</strong> {brand_model}</div>
  <span class="status">{light}</span>
  <table>
    <tbody>
      <tr><th>Current shift</th><td>{current_shift}</td></tr>
      <tr><th>Operator</th><td>{operator}</td></tr>
      <tr><th>Helper</th><td>{helper}</td></tr>
      <tr><th>Lot</th><td>{lot_number}</td></tr>
      <tr><th>Design</th><td>{design_name}</td></tr>
      <tr><th>Party</th><td>{party_name}</td></tr>
      <tr><th>Today's output by shift</th><td>{quantity_by_shift}</td></tr>
    </tbody>
  </table>
  <div class="meta" style="margin-top:16px;">Generated {generated_at}</div>
</body>
</html>"""


def _compute_machine_status(db: Session, machines: list[Machine]) -> list[MachineStatusOut]:
    """Shared by GET /machines/status (the board) and GET
    /machines/{id}/status/pdf (a single-machine snapshot). current_shift/
    operator/helper/lot/design/party are read from each machine's own
    persistent assignment fields (set via PUT /machines/{id}/assignment,
    the "Assign work" section) -- NOT derived from production entries.
    quantity_by_shift_today is still a live computation from today's real
    entries, since it's an actual output figure rather than a staffing fact."""
    if not machines:
        return []

    today = date.today()
    machine_ids = [m.id for m in machines]

    entry_rows = (
        db.query(
            ProductionJobMachineAllocation.machine_id,
            MachineProductionEntry.shift,
            MachineProductionEntry.quantity,
        )
        .join(
            MachineProductionEntry,
            MachineProductionEntry.production_job_machine_allocation_id == ProductionJobMachineAllocation.id,
        )
        .filter(
            MachineProductionEntry.entry_date == today,
            MachineProductionEntry.status != "rejected",
            ProductionJobMachineAllocation.machine_id.in_(machine_ids),
        )
        .all()
    )
    quantity_by_machine_shift: dict[uuid.UUID, dict[str, int]] = {}
    for machine_id, shift, quantity in entry_rows:
        quantity_by_machine_shift.setdefault(machine_id, {}).setdefault(shift, 0)
        quantity_by_machine_shift[machine_id][shift] += quantity

    employee_ids = set()
    lot_ids = set()
    for m in machines:
        if m.current_operator_employee_id:
            employee_ids.add(m.current_operator_employee_id)
        if m.current_helper_employee_id:
            employee_ids.add(m.current_helper_employee_id)
        if m.current_lot_id:
            lot_ids.add(m.current_lot_id)
    employees = {e.id: e for e in db.query(Employee).filter(Employee.id.in_(employee_ids)).all()} if employee_ids else {}

    # A Lot can have multiple colours/jobs (and so, in principle, multiple
    # designs) -- Design isn't independently pickable per the "Assign work"
    # UI, so this resolves to that lot's first job (by creation order)
    # deterministically rather than asking which colour/job was meant.
    lot_context: dict[uuid.UUID, tuple[Lot, Design | None, Party]] = {}
    if lot_ids:
        lot_party_rows = db.query(Lot, Party).join(Party, Lot.party_id == Party.id).filter(Lot.id.in_(lot_ids)).all()
        job_rows = (
            db.query(LotColour.lot_id, Design)
            .join(ProductionJob, ProductionJob.lot_colour_id == LotColour.id)
            .join(Design, ProductionJob.design_id == Design.id)
            .filter(LotColour.lot_id.in_(lot_ids))
            .order_by(ProductionJob.created_at)
            .all()
        )
        design_by_lot: dict[uuid.UUID, Design] = {}
        for lot_id, design in job_rows:
            design_by_lot.setdefault(lot_id, design)
        for lot, party in lot_party_rows:
            lot_context[lot.id] = (lot, design_by_lot.get(lot.id), party)

    results = []
    for machine in machines:
        if machine.status == "maintenance":
            light = "maintenance"
        elif machine.status == "out_of_order":
            light = "out_of_order"
        elif machine.current_operator_employee_id is not None:
            light = "active"
        else:
            light = "idle"

        operator = employees.get(machine.current_operator_employee_id) if machine.current_operator_employee_id else None
        helper = employees.get(machine.current_helper_employee_id) if machine.current_helper_employee_id else None
        lot, design, party = (
            lot_context.get(machine.current_lot_id, (None, None, None)) if machine.current_lot_id else (None, None, None)
        )

        results.append(
            MachineStatusOut(
                machine_id=machine.id,
                light=light,
                current_shift=machine.current_shift,
                current_operator_id=machine.current_operator_employee_id,
                current_operator_name=operator.full_name if operator else None,
                current_helper_id=machine.current_helper_employee_id,
                current_helper_name=helper.full_name if helper else None,
                current_lot_id=lot.id if lot else None,
                current_lot_number=lot.lot_number if lot else None,
                current_design_id=design.id if design else None,
                current_design_name=design.name if design else None,
                current_party_id=party.id if party else None,
                current_party_name=party.name if party else None,
                quantity_by_shift_today=quantity_by_machine_shift.get(machine.id, {}),
            )
        )
    return results


@router.get("", response_model=list[MachineOut], operation_id="listMachines")
def list_machines(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    is_active: bool = True,
    code: str | None = None,
    branch_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("machines.view")),
) -> list[Machine]:
    query = db.query(Machine).filter(Machine.is_active == is_active)
    if code:
        query = query.filter(Machine.code.ilike(f"%{code}%"))
    if branch_id:
        query = query.filter(Machine.branch_id == branch_id)
    return query.order_by(Machine.code).offset(skip).limit(limit).all()


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=MachineOut, operation_id="createMachine"
)
def create_machine(
    payload: MachineCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("machines.create")),
) -> Machine:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")

    machine = Machine(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(machine)
    db.flush()  # populate machine.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="machine",
        entity_id=machine.id,
        new_values=payload.model_dump(),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(machine)
    return machine


@router.get("/status", response_model=list[MachineStatusOut], operation_id="getMachineStatusBoard")
def get_machine_status_board(
    branch_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("machines.view")),
) -> list[MachineStatusOut]:
    machines_query = db.query(Machine).filter(Machine.is_active.is_(True))
    if branch_id:
        machines_query = machines_query.filter(Machine.branch_id == branch_id)
    machines = machines_query.order_by(Machine.code).all()
    return _compute_machine_status(db, machines)


@router.get(
    "/{machine_id}/allocations", response_model=list[MachineAllocationOut], operation_id="listMachineAllocations"
)
def list_machine_allocations(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("machines.view")),
) -> list[MachineAllocationOut]:
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="machine_not_found")

    rows = (
        db.query(ProductionJobMachineAllocation, ProductionJobComponent, ProductionJob, LotColour, Lot, Design, Party)
        .join(
            ProductionJobComponent,
            ProductionJobMachineAllocation.production_job_component_id == ProductionJobComponent.id,
        )
        .join(ProductionJob, ProductionJobComponent.production_job_id == ProductionJob.id)
        .join(LotColour, ProductionJob.lot_colour_id == LotColour.id)
        .join(Lot, LotColour.lot_id == Lot.id)
        .join(Design, ProductionJob.design_id == Design.id)
        .join(Party, Lot.party_id == Party.id)
        .filter(ProductionJobMachineAllocation.machine_id == machine_id)
        .order_by(Lot.received_date.desc())
        .all()
    )

    results = []
    for allocation, component, job, lot_colour, lot, design, party in rows:
        approved = (
            db.query(func.coalesce(func.sum(MachineProductionEntry.quantity), 0))
            .filter(
                MachineProductionEntry.production_job_machine_allocation_id == allocation.id,
                MachineProductionEntry.status == "approved",
            )
            .scalar()
        )
        results.append(
            MachineAllocationOut(
                allocation_id=allocation.id,
                component_type=component.component_type,
                lot_id=lot.id,
                lot_number=lot.lot_number,
                colour_name=lot_colour.colour_name,
                design_id=design.id,
                design_name=design.name,
                party_name=party.name,
                allocated_quantity=allocation.allocated_quantity,
                approved_quantity=int(approved),
                remaining_quantity=allocation.allocated_quantity - int(approved),
            )
        )
    return results


@router.get(
    "/{machine_id}/status-history",
    response_model=list[MachineStatusHistoryOut],
    operation_id="getMachineStatusHistory",
)
def get_machine_status_history(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("machines.view")),
) -> list[MachineStatusHistoryOut]:
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="machine_not_found")

    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.entity_type == "machine",
            AuditLog.entity_id == machine_id,
            AuditLog.action == "update",
        )
        .order_by(AuditLog.created_at.desc())
        .all()
    )

    actor_ids = {log.actor_user_id for log in logs if log.actor_user_id}
    actors = {u.id: u for u in db.query(User).filter(User.id.in_(actor_ids)).all()} if actor_ids else {}

    results = []
    for log in logs:
        new_values = log.new_values or {}
        old_values = log.old_values or {}
        if "status" not in new_values:
            continue
        actor = actors.get(log.actor_user_id) if log.actor_user_id else None
        results.append(
            MachineStatusHistoryOut(
                changed_at=log.created_at,
                old_status=old_values.get("status"),
                new_status=new_values.get("status"),
                actor_name=actor.full_name if actor else None,
            )
        )
    return results


@router.get("/{machine_id}/status/pdf", operation_id="getMachineStatusPdf")
def get_machine_status_pdf(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("machines.view")),
) -> Response:
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="machine_not_found")

    [status_out] = _compute_machine_status(db, [machine])

    quantity_by_shift = (
        ", ".join(
            f"{SHIFT_LABELS.get(shift, shift)}: {qty}"
            for shift, qty in status_out.quantity_by_shift_today.items()
        )
        or "—"
    )
    html_doc = MACHINE_STATUS_PDF_TEMPLATE.format(
        code=html_escape.escape(machine.code),
        name=html_escape.escape(machine.name or "—"),
        machine_type=html_escape.escape(machine.machine_type or "—"),
        brand_model=html_escape.escape(f"{machine.brand or '—'} {machine.model or ''}".strip()),
        light=html_escape.escape(status_out.light.replace("_", " ")),
        current_shift=html_escape.escape(SHIFT_LABELS.get(status_out.current_shift or "", status_out.current_shift or "—")),
        operator=html_escape.escape(status_out.current_operator_name or "—"),
        helper=html_escape.escape(status_out.current_helper_name or "—"),
        lot_number=html_escape.escape(status_out.current_lot_number or "—"),
        design_name=html_escape.escape(status_out.current_design_name or "—"),
        party_name=html_escape.escape(status_out.current_party_name or "—"),
        quantity_by_shift=html_escape.escape(quantity_by_shift),
        generated_at=date.today().isoformat(),
    )
    pdf_bytes = html_to_pdf(html_doc)
    filename = html_escape.escape(f"{machine.code}-status.pdf")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.put("/{machine_id}/assignment", response_model=MachineOut, operation_id="setMachineAssignment")
def set_machine_assignment(
    machine_id: uuid.UUID,
    payload: MachineAssignmentRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("machines.edit")),
) -> Machine:
    """Full replace of "who's on this machine right now" (see
    MachineAssignmentRequest) -- the Machine Detail page's "Assign work"
    section. Sending every field as null clears the assignment."""
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="machine_not_found")

    if payload.current_operator_employee_id is not None:
        if db.get(Employee, payload.current_operator_employee_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="operator_not_found")
    if payload.current_helper_employee_id is not None:
        if db.get(Employee, payload.current_helper_employee_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="helper_not_found")
    if payload.current_lot_id is not None:
        if db.get(Lot, payload.current_lot_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="lot_not_found")

    def _snapshot() -> dict:
        return {
            "current_shift": machine.current_shift,
            "current_operator_employee_id": str(machine.current_operator_employee_id)
            if machine.current_operator_employee_id
            else None,
            "current_helper_employee_id": str(machine.current_helper_employee_id)
            if machine.current_helper_employee_id
            else None,
            "current_lot_id": str(machine.current_lot_id) if machine.current_lot_id else None,
        }

    old_values = _snapshot()
    machine.current_shift = payload.current_shift
    machine.current_operator_employee_id = payload.current_operator_employee_id
    machine.current_helper_employee_id = payload.current_helper_employee_id
    machine.current_lot_id = payload.current_lot_id
    new_values = _snapshot()

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="update",
        entity_type="machine",
        entity_id=machine.id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(machine)
    return machine


@router.get("/{machine_id}", response_model=MachineOut, operation_id="getMachine")
def get_machine(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("machines.view")),
) -> Machine:
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="machine_not_found")
    return machine


@router.patch("/{machine_id}", response_model=MachineOut, operation_id="updateMachine")
def update_machine(
    machine_id: uuid.UUID,
    payload: MachineUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("machines.edit")),
) -> Machine:
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="machine_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        current = getattr(machine, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(machine, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="machine",
            entity_id=machine.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(machine)
    return machine
