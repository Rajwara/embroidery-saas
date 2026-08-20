import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class MachineCreateRequest(BaseModel):
    branch_id: uuid.UUID
    code: str
    name: str | None = None
    machine_type: str | None = None
    number_of_heads: int | None = None
    brand: str | None = None
    model: str | None = None
    purchase_date: date | None = None
    status: str = "active"
    notes: str | None = None
    # is_active excluded -- always starts True.


class MachineUpdateRequest(BaseModel):
    code: str | None = None
    name: str | None = None
    machine_type: str | None = None
    number_of_heads: int | None = None
    brand: str | None = None
    model: str | None = None
    purchase_date: date | None = None
    status: str | None = None
    notes: str | None = None
    is_active: bool | None = None
    # branch_id excluded -- immutable.


class MachineOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    code: str
    name: str | None
    machine_type: str | None
    number_of_heads: int | None
    brand: str | None
    model: str | None
    purchase_date: date | None
    status: str
    notes: str | None
    is_active: bool
    # "Who's on this machine right now" -- explicit, persistent, set via
    # PUT /machines/{id}/assignment, not derived from production entries.
    # See Machine model's docstring on these columns.
    current_shift: str | None
    current_operator_employee_id: uuid.UUID | None
    current_helper_employee_id: uuid.UUID | None
    current_lot_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class MachineAssignmentRequest(BaseModel):
    """Full replace, not a partial PATCH -- every field is always applied
    (unlike MachineUpdateRequest's exclude-None convention), so clearing the
    assignment is just sending all fields as null."""

    current_shift: str | None = None
    current_operator_employee_id: uuid.UUID | None = None
    current_helper_employee_id: uuid.UUID | None = None
    current_lot_id: uuid.UUID | None = None


class MachineStatusOut(BaseModel):
    """One machine's current floor snapshot (see routers/machines.py's
    get_machine_status_board). current_shift/operator/helper/lot/design/party
    are read from the machine's own persistent assignment fields (set via
    "Assign work" on the Machine Detail page) -- NOT derived from production
    entries. quantity_by_shift_today is the one part that's still a live
    computation, since it's a real output figure, not a staffing fact."""

    machine_id: uuid.UUID
    light: Literal["active", "maintenance", "out_of_order", "idle"]
    current_shift: str | None
    current_operator_id: uuid.UUID | None
    current_operator_name: str | None
    current_helper_id: uuid.UUID | None
    current_helper_name: str | None
    current_lot_id: uuid.UUID | None
    current_lot_number: str | None
    current_design_id: uuid.UUID | None
    current_design_name: str | None
    current_party_id: uuid.UUID | None
    current_party_name: str | None
    # Pieces produced today (pending + approved, rejected excluded), by
    # shift -- the real data that exists, shown instead of "hours" (which
    # isn't tracked anywhere in this schema).
    quantity_by_shift_today: dict[str, int]


class MachineAllocationOut(BaseModel):
    """One of this machine's ProductionJobMachineAllocation rows, with
    lot/design/party context (see routers/machines.py's
    list_machine_allocations) -- for logging actual produced quantity
    against a specific component, as opposed to the lighter-weight "who's
    currently assigned" concept in MachineAssignmentRequest."""

    allocation_id: uuid.UUID
    component_type: str
    lot_id: uuid.UUID
    lot_number: str
    colour_name: str
    design_id: uuid.UUID
    design_name: str
    party_name: str
    allocated_quantity: int
    approved_quantity: int
    remaining_quantity: int


class MachineStatusHistoryOut(BaseModel):
    """One status-field change, read from the existing audit log (every
    PATCH /machines/{id} that touches status already writes an AuditLog row)
    -- not a dedicated table, see get_machine_status_history."""

    changed_at: datetime
    old_status: str | None
    new_status: str | None
    actor_name: str | None
