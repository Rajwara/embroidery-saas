import uuid
from datetime import date

from pydantic import BaseModel


class EmployeeCreateRequest(BaseModel):
    branch_id: uuid.UUID
    user_id: uuid.UUID | None = None
    employee_code: str
    full_name: str
    designation: str | None = None
    phone: str | None = None
    email: str | None = None
    national_id: str | None = None
    hire_date: date | None = None
    employment_status: str = "active"
    # is_active excluded -- always starts True.


class EmployeeUpdateRequest(BaseModel):
    employee_code: str | None = None
    full_name: str | None = None
    designation: str | None = None
    phone: str | None = None
    email: str | None = None
    national_id: str | None = None
    hire_date: date | None = None
    employment_status: str | None = None
    is_active: bool | None = None
    # branch_id/user_id excluded -- immutable links.


class EmployeeOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    user_id: uuid.UUID | None
    employee_code: str
    full_name: str
    designation: str | None
    phone: str | None
    email: str | None
    national_id: str | None
    hire_date: date | None
    employment_status: str
    is_active: bool

    model_config = {"from_attributes": True}
