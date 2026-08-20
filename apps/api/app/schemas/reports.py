import uuid
from datetime import date

from pydantic import BaseModel


class MachineCostRowOut(BaseModel):
    machine_id: uuid.UUID
    machine_code: str
    machine_name: str | None
    quantity_produced: int
    # Overhead is split equally across active machines in scope (Stage 1
    # rule -- see the module docstring in routers/reports.py for why
    # revenue/profit isn't computed yet).
    overhead_share: float
    cost_per_unit: float | None
    # Stitch-count equivalents -- see app/stitch_resolution.py. cost_per_stitch
    # is None whenever total_stitches is 0 (no resolvable stitch count for
    # anything this machine produced in range).
    total_stitches: int
    quantity_missing_stitch_count: int
    cost_per_stitch: float | None

    model_config = {"from_attributes": True}


class MachineCostReportOut(BaseModel):
    date_from: date
    date_to: date
    branch_id: uuid.UUID | None
    total_overhead: float
    active_machine_count: int
    machines: list[MachineCostRowOut]


class AgeingBuckets(BaseModel):
    current: float  # 0-30 days
    days_31_60: float
    days_61_90: float
    days_over_90: float


class ReceivableAgeingRowOut(BaseModel):
    party_id: uuid.UUID
    party_name: str
    total_outstanding: float
    buckets: AgeingBuckets


class ReceivableAgeingReportOut(BaseModel):
    as_of: date
    total_outstanding: float
    buckets: AgeingBuckets
    parties: list[ReceivableAgeingRowOut]


class FinancialSummaryReportOut(BaseModel):
    date_from: date
    date_to: date
    branch_id: uuid.UUID | None
    revenue: float
    expenses: float
    purchases: float
    net: float
    # Sum of Payment.amount in range -- actual cash collected from Parties,
    # distinct from revenue (invoiced/billed amount above).
    cash_received: float


class FinancialTrendPointOut(BaseModel):
    """One calendar month's summary -- same revenue/expenses/net formulas as
    FinancialSummaryReportOut (expenses here is already expenses+purchases
    combined, matching the Dashboard stat card's definition of "Expenses"),
    just computed per-month instead of over one arbitrary range."""

    year: int
    month: int  # 1-12
    revenue: float
    expenses: float
    net: float


class ProductionByComponentRowOut(BaseModel):
    component_type: str
    quantity: int
    stitches: int
    quantity_missing_stitch_count: int


class ProductionByLotRowOut(BaseModel):
    lot_id: uuid.UUID
    lot_number: str
    quantity: int
    stitches: int
    quantity_missing_stitch_count: int


class ProductionSummaryReportOut(BaseModel):
    date_from: date
    date_to: date
    branch_id: uuid.UUID | None
    total_quantity: int
    # Stitch-count equivalent of total_quantity -- see app/stitch_resolution.py.
    # quantity_missing_stitch_count is the portion of total_quantity that
    # couldn't be converted (no DesignVariant.stitch_count set yet for that
    # design+component).
    total_stitches: int
    quantity_missing_stitch_count: int
    by_component: list[ProductionByComponentRowOut]
    by_lot: list[ProductionByLotRowOut]


class InventoryMovementRowOut(BaseModel):
    inventory_item_id: uuid.UUID
    item_name: str
    unit: str
    opening_stock: int
    receipts: int
    issues: int
    adjustments: int
    closing_stock: int


class InventoryMovementReportOut(BaseModel):
    date_from: date
    date_to: date
    branch_id: uuid.UUID | None
    items: list[InventoryMovementRowOut]
