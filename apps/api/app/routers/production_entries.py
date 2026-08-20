import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import (
    Employee,
    Machine,
    MachineProductionEntry,
    ProductionJob,
    ProductionJobComponent,
    ProductionJobMachineAllocation,
    User,
)
from app.schemas.production_entry import (
    EmployeePerformanceOut,
    MachinePerformanceOut,
    MachineProductionEntryCreateRequest,
    MachineProductionEntryOut,
    ProductionEntryStatusCountsOut,
    RejectEntryRequest,
)
from app.stitch_resolution import resolve_stitch_counts

router = APIRouter()


def _to_entry_out(
    entry: MachineProductionEntry,
    allocation: ProductionJobMachineAllocation,
    component: ProductionJobComponent,
    machine: Machine,
    operator: Employee,
    helper: Employee | None,
) -> MachineProductionEntryOut:
    return MachineProductionEntryOut(
        id=entry.id,
        production_job_machine_allocation_id=entry.production_job_machine_allocation_id,
        entry_date=entry.entry_date,
        shift=entry.shift,
        operator_employee_id=entry.operator_employee_id,
        helper_employee_id=entry.helper_employee_id,
        quantity=entry.quantity,
        status=entry.status,
        rejection_reason=entry.rejection_reason,
        notes=entry.notes,
        machine_id=machine.id,
        machine_code=machine.code,
        production_job_id=component.production_job_id,
        component_type=component.component_type,
        operator_name=operator.full_name,
        helper_name=helper.full_name if helper is not None else None,
    )


def _entry_out_by_id(db: Session, entry: MachineProductionEntry) -> MachineProductionEntryOut:
    allocation = db.get(ProductionJobMachineAllocation, entry.production_job_machine_allocation_id)
    component = db.get(ProductionJobComponent, allocation.production_job_component_id)
    machine = db.get(Machine, allocation.machine_id)
    operator = db.get(Employee, entry.operator_employee_id)
    helper = db.get(Employee, entry.helper_employee_id) if entry.helper_employee_id else None
    return _to_entry_out(entry, allocation, component, machine, operator, helper)


@router.get("", response_model=list[MachineProductionEntryOut], operation_id="listProductionEntries")
def list_production_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(None, alias="status"),
    entry_date: date | None = None,
    shift: str | None = None,
    machine_id: uuid.UUID | None = None,
    operator_employee_id: uuid.UUID | None = None,
    production_job_machine_allocation_id: uuid.UUID | None = None,
    mine_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("production_entries.view")),
) -> list[MachineProductionEntryOut]:
    query = (
        db.query(MachineProductionEntry, ProductionJobMachineAllocation, ProductionJobComponent, Machine, Employee)
        .join(
            ProductionJobMachineAllocation,
            MachineProductionEntry.production_job_machine_allocation_id == ProductionJobMachineAllocation.id,
        )
        .join(
            ProductionJobComponent,
            ProductionJobMachineAllocation.production_job_component_id == ProductionJobComponent.id,
        )
        .join(Machine, ProductionJobMachineAllocation.machine_id == Machine.id)
        .join(Employee, MachineProductionEntry.operator_employee_id == Employee.id)
    )
    if status_filter:
        query = query.filter(MachineProductionEntry.status == status_filter)
    if entry_date:
        query = query.filter(MachineProductionEntry.entry_date == entry_date)
    if shift:
        query = query.filter(MachineProductionEntry.shift == shift)
    if machine_id:
        query = query.filter(ProductionJobMachineAllocation.machine_id == machine_id)
    if operator_employee_id:
        query = query.filter(MachineProductionEntry.operator_employee_id == operator_employee_id)
    if production_job_machine_allocation_id:
        query = query.filter(
            MachineProductionEntry.production_job_machine_allocation_id == production_job_machine_allocation_id
        )
    if mine_only:
        # Who submitted the entry, not who the operator/helper were -- see
        # MachineProductionEntry.logged_by_user_id's docstring. Entries
        # created before this column existed have it as NULL and will
        # never match here, for anyone.
        query = query.filter(MachineProductionEntry.logged_by_user_id == user.id)

    rows = (
        query.order_by(MachineProductionEntry.entry_date.desc(), MachineProductionEntry.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    helper_ids = {entry.helper_employee_id for entry, *_ in rows if entry.helper_employee_id is not None}
    helpers = {e.id: e for e in db.query(Employee).filter(Employee.id.in_(helper_ids)).all()} if helper_ids else {}

    return [
        _to_entry_out(entry, allocation, component, machine, operator, helpers.get(entry.helper_employee_id))
        for entry, allocation, component, machine, operator in rows
    ]


def _approved_range_filters(start_date: date | None, end_date: date | None) -> list:
    filters = [MachineProductionEntry.status == "approved"]
    if start_date:
        filters.append(MachineProductionEntry.entry_date >= start_date)
    if end_date:
        filters.append(MachineProductionEntry.entry_date <= end_date)
    return filters


@router.get(
    "/performance/machines", response_model=list[MachinePerformanceOut], operation_id="getMachinePerformance"
)
def get_machine_performance(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("production_entries.view")),
) -> list[MachinePerformanceOut]:
    filters = _approved_range_filters(start_date, end_date)

    grand_total = db.query(func.coalesce(func.sum(MachineProductionEntry.quantity), 0)).filter(*filters).scalar()

    # Grouped down to (machine, design, component) rather than just machine,
    # since stitch_count resolution (app/stitch_resolution.py) is keyed on
    # design+component -- a machine can touch multiple designs/components in
    # the same date range, each with its own stitch count.
    rows = (
        db.query(
            ProductionJobMachineAllocation.machine_id,
            ProductionJob.design_id,
            ProductionJobComponent.component_type,
            func.sum(MachineProductionEntry.quantity).label("total_quantity"),
            func.count(MachineProductionEntry.id).label("entry_count"),
        )
        .join(
            ProductionJobMachineAllocation,
            MachineProductionEntry.production_job_machine_allocation_id == ProductionJobMachineAllocation.id,
        )
        .join(
            ProductionJobComponent,
            ProductionJobMachineAllocation.production_job_component_id == ProductionJobComponent.id,
        )
        .join(ProductionJob, ProductionJobComponent.production_job_id == ProductionJob.id)
        .filter(*filters)
        .group_by(ProductionJobMachineAllocation.machine_id, ProductionJob.design_id, ProductionJobComponent.component_type)
        .all()
    )

    stitch_map = resolve_stitch_counts(db, {(design_id, component_type) for _, design_id, component_type, _, _ in rows})

    machine_totals: dict[uuid.UUID, dict[str, int]] = {}
    for machine_id, design_id, component_type, total_quantity, entry_count in rows:
        bucket = machine_totals.setdefault(
            machine_id, {"total_quantity": 0, "entry_count": 0, "total_stitches": 0, "quantity_missing_stitch_count": 0}
        )
        bucket["total_quantity"] += total_quantity
        bucket["entry_count"] += entry_count
        stitch_count = stitch_map.get((design_id, component_type))
        if stitch_count:
            bucket["total_stitches"] += total_quantity * stitch_count
        else:
            bucket["quantity_missing_stitch_count"] += total_quantity

    machine_ids = list(machine_totals.keys())
    machines = {m.id: m for m in db.query(Machine).filter(Machine.id.in_(machine_ids)).all()} if machine_ids else {}

    results = [
        MachinePerformanceOut(
            machine_id=machine_id,
            machine_code=machines[machine_id].code,
            total_quantity=bucket["total_quantity"],
            entry_count=bucket["entry_count"],
            percentage_of_total=round(bucket["total_quantity"] / grand_total * 100, 1) if grand_total else 0.0,
            total_stitches=bucket["total_stitches"],
            quantity_missing_stitch_count=bucket["quantity_missing_stitch_count"],
        )
        for machine_id, bucket in machine_totals.items()
    ]
    results.sort(key=lambda r: r.total_quantity, reverse=True)
    return results


@router.get(
    "/performance/employees", response_model=list[EmployeePerformanceOut], operation_id="getEmployeePerformance"
)
def get_employee_performance(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("production_entries.view")),
) -> list[EmployeePerformanceOut]:
    filters = _approved_range_filters(start_date, end_date)

    grand_total = db.query(func.coalesce(func.sum(MachineProductionEntry.quantity), 0)).filter(*filters).scalar()

    # Both operator and helper get full credit on their own totals for a
    # shared entry (see [[domain_production_entry]] memory) -- summed from
    # two separate group-bys rather than a single query, since an entry
    # contributes to two different employees' totals at once. Grouped down
    # to (employee, design, component) for the same reason as
    # get_machine_performance -- stitch resolution is keyed on design+component.
    design_component_join = (
        lambda q: q.join(
            ProductionJobMachineAllocation,
            MachineProductionEntry.production_job_machine_allocation_id == ProductionJobMachineAllocation.id,
        )
        .join(
            ProductionJobComponent,
            ProductionJobMachineAllocation.production_job_component_id == ProductionJobComponent.id,
        )
        .join(ProductionJob, ProductionJobComponent.production_job_id == ProductionJob.id)
    )

    operator_rows = design_component_join(
        db.query(
            MachineProductionEntry.operator_employee_id.label("employee_id"),
            ProductionJob.design_id,
            ProductionJobComponent.component_type,
            func.sum(MachineProductionEntry.quantity).label("total_quantity"),
            func.count(MachineProductionEntry.id).label("entry_count"),
        )
    ).filter(*filters).group_by(
        MachineProductionEntry.operator_employee_id, ProductionJob.design_id, ProductionJobComponent.component_type
    ).all()
    helper_rows = design_component_join(
        db.query(
            MachineProductionEntry.helper_employee_id.label("employee_id"),
            ProductionJob.design_id,
            ProductionJobComponent.component_type,
            func.sum(MachineProductionEntry.quantity).label("total_quantity"),
            func.count(MachineProductionEntry.id).label("entry_count"),
        )
    ).filter(*filters, MachineProductionEntry.helper_employee_id.isnot(None)).group_by(
        MachineProductionEntry.helper_employee_id, ProductionJob.design_id, ProductionJobComponent.component_type
    ).all()

    all_rows = [*operator_rows, *helper_rows]
    stitch_map = resolve_stitch_counts(db, {(design_id, component_type) for _, design_id, component_type, _, _ in all_rows})

    totals: dict[uuid.UUID, dict[str, int]] = {}
    for employee_id, design_id, component_type, total_quantity, entry_count in all_rows:
        bucket = totals.setdefault(
            employee_id, {"total_quantity": 0, "entry_count": 0, "total_stitches": 0, "quantity_missing_stitch_count": 0}
        )
        bucket["total_quantity"] += total_quantity
        bucket["entry_count"] += entry_count
        stitch_count = stitch_map.get((design_id, component_type))
        if stitch_count:
            bucket["total_stitches"] += total_quantity * stitch_count
        else:
            bucket["quantity_missing_stitch_count"] += total_quantity

    employees = {e.id: e for e in db.query(Employee).filter(Employee.id.in_(totals.keys())).all()} if totals else {}

    results = [
        EmployeePerformanceOut(
            employee_id=employee_id,
            full_name=employees[employee_id].full_name,
            total_quantity=bucket["total_quantity"],
            entry_count=bucket["entry_count"],
            percentage_of_total=round(bucket["total_quantity"] / grand_total * 100, 1) if grand_total else 0.0,
            total_stitches=bucket["total_stitches"],
            quantity_missing_stitch_count=bucket["quantity_missing_stitch_count"],
        )
        for employee_id, bucket in totals.items()
    ]
    results.sort(key=lambda r: r.total_quantity, reverse=True)
    return results


@router.get(
    "/status-counts", response_model=ProductionEntryStatusCountsOut, operation_id="getProductionEntryStatusCounts"
)
def get_production_entry_status_counts(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("production_entries.view")),
) -> ProductionEntryStatusCountsOut:
    filters = []
    if start_date:
        filters.append(MachineProductionEntry.entry_date >= start_date)
    if end_date:
        filters.append(MachineProductionEntry.entry_date <= end_date)

    rows = (
        db.query(MachineProductionEntry.status, func.count(MachineProductionEntry.id))
        .filter(*filters)
        .group_by(MachineProductionEntry.status)
        .all()
    )
    counts = {status_value: count for status_value, count in rows}
    return ProductionEntryStatusCountsOut(
        pending=counts.get("pending", 0),
        approved=counts.get("approved", 0),
        rejected=counts.get("rejected", 0),
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=MachineProductionEntryOut,
    operation_id="createProductionEntry",
)
def create_production_entry(
    payload: MachineProductionEntryCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("production_entries.create")),
) -> MachineProductionEntryOut:
    allocation = db.get(ProductionJobMachineAllocation, payload.production_job_machine_allocation_id)
    if allocation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="allocation_not_found")
    component = db.get(ProductionJobComponent, allocation.production_job_component_id)
    machine = db.get(Machine, allocation.machine_id)

    operator = db.get(Employee, payload.operator_employee_id)
    if operator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="operator_not_found")

    helper = None
    if payload.helper_employee_id is not None:
        helper = db.get(Employee, payload.helper_employee_id)
        if helper is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="helper_not_found")

    if payload.quantity <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="quantity_must_be_positive")

    entry = MachineProductionEntry(
        tenant_id=user.tenant_id,
        production_job_machine_allocation_id=allocation.id,
        entry_date=payload.entry_date,
        shift=payload.shift,
        operator_employee_id=payload.operator_employee_id,
        helper_employee_id=payload.helper_employee_id,
        quantity=payload.quantity,
        status="pending",
        notes=payload.notes,
        logged_by_user_id=user.id,
    )
    db.add(entry)
    db.flush()  # populate entry.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="production_entry",
        entity_id=entry.id,
        new_values={
            "production_job_machine_allocation_id": str(allocation.id),
            "entry_date": str(payload.entry_date),
            "shift": payload.shift,
            "quantity": payload.quantity,
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(entry)
    return _to_entry_out(entry, allocation, component, machine, operator, helper)


@router.get("/{entry_id}", response_model=MachineProductionEntryOut, operation_id="getProductionEntry")
def get_production_entry(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("production_entries.view")),
) -> MachineProductionEntryOut:
    entry = db.get(MachineProductionEntry, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="entry_not_found")
    return _entry_out_by_id(db, entry)


@router.post("/{entry_id}/approve", response_model=MachineProductionEntryOut, operation_id="approveProductionEntry")
def approve_production_entry(
    entry_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("production_entries.approve")),
) -> MachineProductionEntryOut:
    entry = db.get(MachineProductionEntry, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="entry_not_found")
    if entry.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="entry_not_pending")

    allocation = db.get(ProductionJobMachineAllocation, entry.production_job_machine_allocation_id)

    # Cap: the sum of already-approved entries for this allocation plus this
    # one can't exceed the allocation's allocated_quantity (see
    # [[domain_production_entry]] memory -- pending entries don't count
    # toward this cap, only approved ones).
    already_approved = (
        db.query(func.coalesce(func.sum(MachineProductionEntry.quantity), 0))
        .filter(
            MachineProductionEntry.production_job_machine_allocation_id == allocation.id,
            MachineProductionEntry.status == "approved",
        )
        .scalar()
    )
    if already_approved + entry.quantity > allocation.allocated_quantity:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="quantity_exceeds_allocation")

    entry.status = "approved"

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="approve",
        entity_type="production_entry",
        entity_id=entry.id,
        new_values={"status": "approved"},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(entry)
    return _entry_out_by_id(db, entry)


@router.post("/{entry_id}/reject", response_model=MachineProductionEntryOut, operation_id="rejectProductionEntry")
def reject_production_entry(
    entry_id: uuid.UUID,
    payload: RejectEntryRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("production_entries.approve")),
) -> MachineProductionEntryOut:
    entry = db.get(MachineProductionEntry, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="entry_not_found")
    if entry.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="entry_not_pending")

    entry.status = "rejected"
    entry.rejection_reason = payload.reason

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="reject",
        entity_type="production_entry",
        entity_id=entry.id,
        new_values={"status": "rejected", "rejection_reason": payload.reason},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(entry)
    return _entry_out_by_id(db, entry)
