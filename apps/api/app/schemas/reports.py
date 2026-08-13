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
