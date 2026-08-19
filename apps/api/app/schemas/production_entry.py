import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

Shift = Literal["morning", "evening", "night"]


class MachineProductionEntryCreateRequest(BaseModel):
    production_job_machine_allocation_id: uuid.UUID
    entry_date: date
    shift: Shift
    operator_employee_id: uuid.UUID
    helper_employee_id: uuid.UUID | None = None
    quantity: int
    notes: str | None = None
    # status/rejection_reason excluded -- always starts "pending",
    # lifecycle-controlled by the approve/reject endpoints.


class RejectEntryRequest(BaseModel):
    reason: str | None = None


class MachineProductionEntryOut(BaseModel):
    id: uuid.UUID
    production_job_machine_allocation_id: uuid.UUID
    entry_date: date
    shift: str
    operator_employee_id: uuid.UUID
    helper_employee_id: uuid.UUID | None
    quantity: int
    status: str
    rejection_reason: str | None
    notes: str | None
    # Denormalized read-only convenience fields -- joined in by the router
    # (see routers/production_entries.py's _to_entry_out), not stored
    # columns. Saves the frontend from N+1 lookups to show "what machine,
    # what component, who logged it" on the Daily Shift Screen / Approval
    # Queue (Phase 2 item 8).
    machine_id: uuid.UUID
    machine_code: str
    production_job_id: uuid.UUID
    component_type: str
    operator_name: str
    helper_name: str | None

    model_config = {"from_attributes": True}


class MachinePerformanceOut(BaseModel):
    """One machine's share of total approved production over the queried
    date range (see routers/production_entries.py's performance
    endpoints). percentage_of_total is relative to the grand total of all
    approved quantity in the same range, not to other machines' totals."""

    machine_id: uuid.UUID
    machine_code: str
    total_quantity: int
    entry_count: int
    percentage_of_total: float


class ProductionEntryStatusCountsOut(BaseModel):
    """Counts by status over an optional entry_date range -- a real GROUP BY
    query, not derived from a capped list fetch, so it stays accurate
    regardless of how many entries exist in the period."""

    pending: int
    approved: int
    rejected: int


class EmployeePerformanceOut(BaseModel):
    """One employee's share of total approved production over the queried
    date range. total_quantity credits an employee for entries where they
    were either the operator or the helper -- both roles get full credit
    on their own totals (see [[domain_production_entry]] memory), so
    percentages across all employees can sum to more than 100%."""

    employee_id: uuid.UUID
    full_name: str
    total_quantity: int
    entry_count: int
    percentage_of_total: float
