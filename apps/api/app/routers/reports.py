"""
Phase 5 reporting. All reports here are fully computed from existing
tenant-scoped tables -- no new tables, no stored ledgers.

Machine Detail/Profitability ships as a *cost* report only -- overhead split
equally across active machines in scope, per the roadmap's explicit Stage 1
rule. True profitability (revenue - cost) is deliberately deferred:
InvoiceLineItem has no way to trace back to the LotColour it was billed for
(per_suit lines are free-text description + quantity; stitch_based lines
link to a DesignVariant, which maps to a Design, and a Design isn't unique
to one LotColour), so there is no reliable way to attribute invoiced revenue
down to the machines that produced it without a schema + invoicing-UX
change. Revisit once InvoiceLineItem can be traced to a LotColour.

Payable Ageing (supplier side) does not exist here at all and isn't planned
for this pass: there is no supplier-payment tracking anywhere in the app
(PaymentAllocation.allocation_type has no supplier-side value, Purchase has
no "amount paid"), so there is no "amount owed" figure to age. Receivable
Ageing (party side) is fully computable via the existing
Payment/PaymentAllocation system and is implemented below.
"""

import calendar
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import require_permission
from app.models import (
    Expense,
    InventoryItem,
    Invoice,
    InvoiceLineItem,
    Lot,
    LotColour,
    Machine,
    MachineProductionEntry,
    Party,
    Payment,
    ProductionJob,
    ProductionJobComponent,
    ProductionJobMachineAllocation,
    Purchase,
    PurchaseLineItem,
    StockTransaction,
    User,
)
from app.routers.payments import _invoice_paid_amount, _invoice_total
from app.schemas.reports import (
    AgeingBuckets,
    FinancialSummaryReportOut,
    FinancialTrendPointOut,
    InventoryMovementReportOut,
    InventoryMovementRowOut,
    MachineCostReportOut,
    MachineCostRowOut,
    ProductionByComponentRowOut,
    ProductionByLotRowOut,
    ProductionSummaryReportOut,
    ReceivableAgeingReportOut,
    ReceivableAgeingRowOut,
)
from app.stitch_resolution import resolve_stitch_counts

router = APIRouter()

AGEING_BUCKET_KEYS = ("current", "days_31_60", "days_61_90", "days_over_90")


def _ageing_bucket_for_days(days: int) -> str:
    if days <= 30:
        return "current"
    if days <= 60:
        return "days_31_60"
    if days <= 90:
        return "days_61_90"
    return "days_over_90"


def _zero_buckets() -> dict[str, float]:
    return {key: 0.0 for key in AGEING_BUCKET_KEYS}


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

    # Grouped down to (machine, design, component) rather than just machine,
    # since stitch_count resolution (app/stitch_resolution.py) is keyed on
    # design+component.
    machine_totals: dict[uuid.UUID, dict[str, int]] = {}
    if machines:
        rows = (
            db.query(
                ProductionJobMachineAllocation.machine_id,
                ProductionJob.design_id,
                ProductionJobComponent.component_type,
                func.sum(MachineProductionEntry.quantity).label("total_quantity"),
            )
            .join(
                MachineProductionEntry,
                MachineProductionEntry.production_job_machine_allocation_id == ProductionJobMachineAllocation.id,
            )
            .join(
                ProductionJobComponent,
                ProductionJobMachineAllocation.production_job_component_id == ProductionJobComponent.id,
            )
            .join(ProductionJob, ProductionJobComponent.production_job_id == ProductionJob.id)
            .filter(
                MachineProductionEntry.status == "approved",
                MachineProductionEntry.entry_date >= date_from,
                MachineProductionEntry.entry_date <= date_to,
                ProductionJobMachineAllocation.machine_id.in_([m.id for m in machines]),
            )
            .group_by(ProductionJobMachineAllocation.machine_id, ProductionJob.design_id, ProductionJobComponent.component_type)
            .all()
        )
        stitch_map = resolve_stitch_counts(db, {(design_id, component_type) for _, design_id, component_type, _ in rows})
        for machine_id, design_id, component_type, total_quantity in rows:
            bucket = machine_totals.setdefault(
                machine_id, {"quantity_produced": 0, "total_stitches": 0, "quantity_missing_stitch_count": 0}
            )
            bucket["quantity_produced"] += total_quantity
            stitch_count = stitch_map.get((design_id, component_type))
            if stitch_count:
                bucket["total_stitches"] += total_quantity * stitch_count
            else:
                bucket["quantity_missing_stitch_count"] += total_quantity

    machine_rows = [
        MachineCostRowOut(
            machine_id=machine.id,
            machine_code=machine.code,
            machine_name=machine.name,
            quantity_produced=machine_totals.get(machine.id, {}).get("quantity_produced", 0),
            overhead_share=overhead_share,
            cost_per_unit=(
                round(overhead_share / machine_totals[machine.id]["quantity_produced"], 2)
                if machine_totals.get(machine.id, {}).get("quantity_produced")
                else None
            ),
            total_stitches=machine_totals.get(machine.id, {}).get("total_stitches", 0),
            quantity_missing_stitch_count=machine_totals.get(machine.id, {}).get("quantity_missing_stitch_count", 0),
            cost_per_stitch=(
                round(overhead_share / machine_totals[machine.id]["total_stitches"], 4)
                if machine_totals.get(machine.id, {}).get("total_stitches")
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


@router.get(
    "/reports/receivables/ageing", response_model=ReceivableAgeingReportOut, operation_id="getReceivableAgeingReport"
)
def get_receivable_ageing_report(
    as_of: date | None = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("reports.view")),
) -> ReceivableAgeingReportOut:
    as_of = as_of or date.today()

    invoices = db.query(Invoice).filter(Invoice.invoice_date <= as_of).all()

    party_buckets: dict[uuid.UUID, dict[str, float]] = {}
    for invoice in invoices:
        remaining = round(_invoice_total(db, invoice.id) - _invoice_paid_amount(db, invoice.id), 2)
        if remaining <= 0:
            continue
        bucket_key = _ageing_bucket_for_days((as_of - invoice.invoice_date).days)
        buckets = party_buckets.setdefault(invoice.party_id, _zero_buckets())
        buckets[bucket_key] += remaining

    totals = _zero_buckets()
    party_rows = []
    for party_id, buckets in party_buckets.items():
        total_outstanding = round(sum(buckets.values()), 2)
        if total_outstanding <= 0:
            continue
        for key in AGEING_BUCKET_KEYS:
            totals[key] += buckets[key]
        party = db.get(Party, party_id)
        party_rows.append(
            ReceivableAgeingRowOut(
                party_id=party_id,
                party_name=party.name if party else "—",
                total_outstanding=total_outstanding,
                buckets=AgeingBuckets(**{key: round(value, 2) for key, value in buckets.items()}),
            )
        )
    party_rows.sort(key=lambda row: row.total_outstanding, reverse=True)

    return ReceivableAgeingReportOut(
        as_of=as_of,
        total_outstanding=round(sum(totals.values()), 2),
        buckets=AgeingBuckets(**{key: round(value, 2) for key, value in totals.items()}),
        parties=party_rows,
    )


def compute_financial_summary(
    db: Session, date_from: date, date_to: date, branch_id: uuid.UUID | None
) -> FinancialSummaryReportOut:
    """Shared by GET /reports/financial/summary and the scheduled-report PDF
    endpoint in routers/scheduled_reports.py -- kept here as a plain function
    (no permission dependency) so both call sites do their own authZ."""
    revenue_query = (
        db.query(func.coalesce(func.sum(InvoiceLineItem.line_total), 0))
        .join(Invoice, InvoiceLineItem.invoice_id == Invoice.id)
        .filter(Invoice.invoice_date >= date_from, Invoice.invoice_date <= date_to)
    )
    if branch_id:
        revenue_query = revenue_query.filter(Invoice.branch_id == branch_id)
    revenue = float(revenue_query.scalar())

    expense_query = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.expense_date >= date_from, Expense.expense_date <= date_to
    )
    if branch_id:
        expense_query = expense_query.filter(Expense.branch_id == branch_id)
    expenses = float(expense_query.scalar())

    purchase_query = (
        db.query(func.coalesce(func.sum(PurchaseLineItem.line_total), 0))
        .join(Purchase, PurchaseLineItem.purchase_id == Purchase.id)
        .filter(Purchase.purchase_date >= date_from, Purchase.purchase_date <= date_to)
    )
    if branch_id:
        purchase_query = purchase_query.filter(Purchase.branch_id == branch_id)
    purchases = float(purchase_query.scalar())

    # Actual cash collected from Parties in the range, distinct from
    # revenue (invoiced/billed amount above) -- a Party can be invoiced in
    # one period and pay in another, so these routinely differ.
    cash_received_query = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_date >= date_from, Payment.payment_date <= date_to
    )
    if branch_id:
        cash_received_query = cash_received_query.filter(Payment.branch_id == branch_id)
    cash_received = float(cash_received_query.scalar())

    return FinancialSummaryReportOut(
        date_from=date_from,
        date_to=date_to,
        branch_id=branch_id,
        revenue=round(revenue, 2),
        expenses=round(expenses, 2),
        purchases=round(purchases, 2),
        net=round(revenue - expenses - purchases, 2),
        cash_received=round(cash_received, 2),
    )


@router.get(
    "/reports/financial/summary", response_model=FinancialSummaryReportOut, operation_id="getFinancialSummaryReport"
)
def get_financial_summary_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    branch_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("reports.view")),
) -> FinancialSummaryReportOut:
    if date_from > date_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="date_from_after_date_to")
    return compute_financial_summary(db, date_from, date_to, branch_id)


@router.get(
    "/reports/financial/trend", response_model=list[FinancialTrendPointOut], operation_id="getFinancialTrendReport"
)
def get_financial_trend_report(
    months: int = Query(12, ge=1, le=24),
    branch_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("reports.view")),
) -> list[FinancialTrendPointOut]:
    """One point per calendar month, oldest first, ending with the current
    (partial) month -- reuses compute_financial_summary per month rather
    than a separate GROUP-BY-month query, so the trend line's math can never
    drift from the summary cards above it on the Dashboard."""
    today = date.today()
    points: list[FinancialTrendPointOut] = []
    for offset in range(months - 1, -1, -1):
        total_month_index = today.year * 12 + (today.month - 1) - offset
        year, month = divmod(total_month_index, 12)
        month += 1
        month_start = date(year, month, 1)
        month_end = date(year, month, calendar.monthrange(year, month)[1])
        summary = compute_financial_summary(db, month_start, month_end, branch_id)
        points.append(
            FinancialTrendPointOut(
                year=year,
                month=month,
                revenue=summary.revenue,
                expenses=round(summary.expenses + summary.purchases, 2),
                net=summary.net,
            )
        )
    return points


@router.get(
    "/reports/production/summary", response_model=ProductionSummaryReportOut, operation_id="getProductionSummaryReport"
)
def get_production_summary_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    branch_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("reports.view")),
) -> ProductionSummaryReportOut:
    if date_from > date_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="date_from_after_date_to")

    query = (
        db.query(
            ProductionJobComponent.component_type,
            ProductionJob.design_id,
            Lot.id,
            Lot.lot_number,
            MachineProductionEntry.quantity,
        )
        .select_from(MachineProductionEntry)
        .join(
            ProductionJobMachineAllocation,
            MachineProductionEntry.production_job_machine_allocation_id == ProductionJobMachineAllocation.id,
        )
        .join(
            ProductionJobComponent,
            ProductionJobMachineAllocation.production_job_component_id == ProductionJobComponent.id,
        )
        .join(ProductionJob, ProductionJobComponent.production_job_id == ProductionJob.id)
        .join(LotColour, ProductionJob.lot_colour_id == LotColour.id)
        .join(Lot, LotColour.lot_id == Lot.id)
        .filter(
            MachineProductionEntry.status == "approved",
            MachineProductionEntry.entry_date >= date_from,
            MachineProductionEntry.entry_date <= date_to,
        )
    )
    if branch_id:
        query = query.filter(Lot.branch_id == branch_id)

    rows = query.all()
    total_quantity = sum(row.quantity for row in rows)

    stitch_map = resolve_stitch_counts(db, {(design_id, component_type) for component_type, design_id, *_ in rows})

    def _stitches_for(design_id: uuid.UUID, component_type: str, quantity: int) -> tuple[int, int]:
        stitch_count = stitch_map.get((design_id, component_type))
        if stitch_count:
            return quantity * stitch_count, 0
        return 0, quantity

    total_stitches = 0
    total_missing = 0
    component_totals: dict[str, dict[str, int]] = {}
    lot_totals: dict[uuid.UUID, dict[str, int | str]] = {}
    for component_type, design_id, lot_id, lot_number, quantity in rows:
        stitches, missing = _stitches_for(design_id, component_type, quantity)
        total_stitches += stitches
        total_missing += missing

        comp_bucket = component_totals.setdefault(
            component_type, {"quantity": 0, "stitches": 0, "quantity_missing_stitch_count": 0}
        )
        comp_bucket["quantity"] += quantity
        comp_bucket["stitches"] += stitches
        comp_bucket["quantity_missing_stitch_count"] += missing

        if lot_id not in lot_totals:
            lot_totals[lot_id] = {"lot_number": lot_number, "quantity": 0, "stitches": 0, "quantity_missing_stitch_count": 0}
        lot_bucket = lot_totals[lot_id]
        lot_bucket["quantity"] += quantity
        lot_bucket["stitches"] += stitches
        lot_bucket["quantity_missing_stitch_count"] += missing

    by_component = [
        ProductionByComponentRowOut(
            component_type=component_type,
            quantity=bucket["quantity"],
            stitches=bucket["stitches"],
            quantity_missing_stitch_count=bucket["quantity_missing_stitch_count"],
        )
        for component_type, bucket in sorted(component_totals.items())
    ]
    by_lot = [
        ProductionByLotRowOut(
            lot_id=lot_id,
            lot_number=bucket["lot_number"],
            quantity=bucket["quantity"],
            stitches=bucket["stitches"],
            quantity_missing_stitch_count=bucket["quantity_missing_stitch_count"],
        )
        for lot_id, bucket in sorted(lot_totals.items(), key=lambda item: item[1]["quantity"], reverse=True)
    ]

    return ProductionSummaryReportOut(
        date_from=date_from,
        date_to=date_to,
        branch_id=branch_id,
        total_quantity=total_quantity,
        total_stitches=total_stitches,
        quantity_missing_stitch_count=total_missing,
        by_component=by_component,
        by_lot=by_lot,
    )


@router.get(
    "/reports/inventory/movement", response_model=InventoryMovementReportOut, operation_id="getInventoryMovementReport"
)
def get_inventory_movement_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    branch_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("reports.view")),
) -> InventoryMovementReportOut:
    if date_from > date_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="date_from_after_date_to")

    items_query = db.query(InventoryItem).filter(InventoryItem.is_active.is_(True))
    if branch_id:
        items_query = items_query.filter(InventoryItem.branch_id == branch_id)
    items = items_query.order_by(InventoryItem.name).all()

    rows = []
    for item in items:
        opening_stock = int(
            db.query(func.coalesce(func.sum(StockTransaction.quantity), 0))
            .filter(StockTransaction.inventory_item_id == item.id, StockTransaction.transaction_date < date_from)
            .scalar()
        )
        period_txns = (
            db.query(StockTransaction.transaction_type, func.coalesce(func.sum(StockTransaction.quantity), 0))
            .filter(
                StockTransaction.inventory_item_id == item.id,
                StockTransaction.transaction_date >= date_from,
                StockTransaction.transaction_date <= date_to,
            )
            .group_by(StockTransaction.transaction_type)
            .all()
        )
        # StockTransaction.quantity is already a signed delta (receipts
        # positive, issues negative -- see create_stock_transaction in
        # routers/inventory.py), so summing by type and adding straight
        # into closing_stock is correct without re-deriving sign here.
        period_by_type = {transaction_type: int(qty) for transaction_type, qty in period_txns}
        receipts = period_by_type.get("receipt", 0)
        issues = period_by_type.get("issue", 0)
        adjustments = period_by_type.get("adjustment", 0)

        rows.append(
            InventoryMovementRowOut(
                inventory_item_id=item.id,
                item_name=item.name,
                unit=item.unit,
                opening_stock=opening_stock,
                receipts=receipts,
                issues=issues,
                adjustments=adjustments,
                closing_stock=opening_stock + receipts + issues + adjustments,
            )
        )

    return InventoryMovementReportOut(date_from=date_from, date_to=date_to, branch_id=branch_id, items=rows)
