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
