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


class ProductionByComponentRowOut(BaseModel):
    component_type: str
    quantity: int


class ProductionByLotRowOut(BaseModel):
    lot_id: uuid.UUID
    lot_number: str
    quantity: int


class ProductionSummaryReportOut(BaseModel):
    date_from: date
    date_to: date
    branch_id: uuid.UUID | None
    total_quantity: int
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
