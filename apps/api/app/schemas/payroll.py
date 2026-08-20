import uuid
from datetime import date

from pydantic import BaseModel


class EmployeeSalaryProfileCreateRequest(BaseModel):
    employee_id: uuid.UUID
    basic_salary: float
    notes: str | None = None


class EmployeeSalaryProfileUpdateRequest(BaseModel):
    basic_salary: float | None = None
    notes: str | None = None


class EmployeeSalaryProfileOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    basic_salary: float
    notes: str | None
    employee_name: str

    model_config = {"from_attributes": True}


class AdvanceCreateRequest(BaseModel):
    employee_id: uuid.UUID
    advance_date: date
    amount: float
    reason: str | None = None


class AdvanceInstallmentOut(BaseModel):
    id: uuid.UUID
    advance_id: uuid.UUID
    payroll_run_id: uuid.UUID
    amount: float
    installment_date: date

    model_config = {"from_attributes": True}


class AdvanceOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    advance_date: date
    amount: float
    reason: str | None
    employee_name: str
    # Denormalized read-only convenience field -- computed by the router
    # from AdvanceInstallment rows, not a stored column (see Advance's
    # docstring for why).
    remaining_balance: float

    model_config = {"from_attributes": True}


class AdvanceDetailOut(AdvanceOut):
    installments: list[AdvanceInstallmentOut]


class BonusCreateRequest(BaseModel):
    employee_id: uuid.UUID
    amount: float
    reason: str | None = None


class DeductionCreateRequest(BaseModel):
    employee_id: uuid.UUID
    amount: float
    reason: str | None = None


class AdvanceInstallmentCreateRequest(BaseModel):
    employee_id: uuid.UUID
    advance_id: uuid.UUID
    amount: float
    installment_date: date


class BonusOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    payroll_run_id: uuid.UUID
    amount: float
    reason: str | None

    model_config = {"from_attributes": True}


class DeductionOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    payroll_run_id: uuid.UUID
    amount: float
    reason: str | None

    model_config = {"from_attributes": True}


class PayrollRunCreateRequest(BaseModel):
    branch_id: uuid.UUID
    year: int
    month: int
    run_date: date


class PayrollEntryOut(BaseModel):
    id: uuid.UUID
    payroll_run_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    basic_salary: float
    # All computed live from Bonus/Deduction/AdvanceInstallment rows for
    # this (employee_id, payroll_run_id) pair -- see PayrollEntry's
    # docstring for why net_pay is never stored.
    total_bonus: float
    total_deduction: float
    total_advance_recovery: float
    net_pay: float

    model_config = {"from_attributes": True}


class PayrollRunOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    year: int
    month: int
    run_date: date
    status: str

    model_config = {"from_attributes": True}


class PayrollRunDetailOut(PayrollRunOut):
    """Used by GET /payroll-runs/{id} -- built manually by the router (no
    ORM relationships defined on PayrollRun), not derived automatically
    from response_model attribute access."""

    entries: list[PayrollEntryOut]


class EmployeePayrollHistoryOut(PayrollEntryOut):
    """One PayrollEntry plus its parent PayrollRun's period/status -- an
    employee's payroll history across ALL runs (see GET /payroll/entries),
    vs. PayrollRunDetailOut which is all employees within ONE run."""

    year: int
    month: int
    run_date: date
    run_status: str
