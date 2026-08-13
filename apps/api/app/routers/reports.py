"""
Phase 5 reporting. Starts with the Machine Detail/Profitability report from
the roadmap, shipped here as a *cost* report only -- overhead split equally
across active machines in scope, per the roadmap's explicit Stage 1 rule.

True profitability (revenue - cost) is deliberately deferred: InvoiceLineItem
has no way to trace back to the LotColour it was billed for (per_suit lines
are free-text description + quantity; stitch_based lines link to a
DesignVariant, which maps to a Design, and a Design isn't unique to one
LotColour), so there is no reliable way to attribute invoiced revenue down to
the machines that produced it without a schema + invoicing-UX change. Revisit
once InvoiceLineItem can be traced to a LotColour.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import require_permission
from app.models import Expense, Machine, MachineProductionEntry, ProductionJobMachineAllocation, User
from app.schemas.reports import MachineCostReportOut, MachineCostRowOut

router = APIRouter()


@router.get(
    "/reports/machines/cost", response_model=MachineCostReportOut, operation_id="getMachineCostReport"
)
def get_machine_cost_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    branch_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("reports.view")),
) -> MachineCostReportOut:
    if date_from > date_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="date_from_after_date_to")

    machines_query = db.query(Machine).filter(Machine.is_active.is_(True))
    if branch_id:
        machines_query = machines_query.filter(Machine.branch_id == branch_id)
    machines = machines_query.order_by(Machine.code).all()

    expense_query = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.expense_date >= date_from, Expense.expense_date <= date_to
    )
    if branch_id:
        expense_query = expense_query.filter(Expense.branch_id == branch_id)
    total_overhead = float(expense_query.scalar())

    overhead_share = round(total_overhead / len(machines), 2) if machines else 0.0

    quantity_by_machine: dict[uuid.UUID, int] = {}
    if machines:
        rows = (
            db.query(
                ProductionJobMachineAllocation.machine_id,
                func.coalesce(func.sum(MachineProductionEntry.quantity), 0),
            )
            .join(
                MachineProductionEntry,
                MachineProductionEntry.production_job_machine_allocation_id == ProductionJobMachineAllocation.id,
            )
            .filter(
                MachineProductionEntry.status == "approved",
                MachineProductionEntry.entry_date >= date_from,
                MachineProductionEntry.entry_date <= date_to,
                ProductionJobMachineAllocation.machine_id.in_([m.id for m in machines]),
            )
            .group_by(ProductionJobMachineAllocation.machine_id)
            .all()
        )
        quantity_by_machine = {machine_id: int(qty) for machine_id, qty in rows}

    machine_rows = [
        MachineCostRowOut(
            machine_id=machine.id,
            machine_code=machine.code,
            machine_name=machine.name,
            quantity_produced=quantity_by_machine.get(machine.id, 0),
            overhead_share=overhead_share,
            cost_per_unit=(
                round(overhead_share / quantity_by_machine[machine.id], 2)
                if quantity_by_machine.get(machine.id)
                else None
            ),
        )
        for machine in machines
    ]

    return MachineCostReportOut(
        date_from=date_from,
        date_to=date_to,
        branch_id=branch_id,
        total_overhead=total_overhead,
        active_machine_count=len(machines),
        machines=machine_rows,
    )
