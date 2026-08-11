import uuid
from datetime import date

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

    model_config = {"from_attributes": True}
