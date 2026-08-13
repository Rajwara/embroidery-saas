import uuid

from sqlalchemy import ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PayrollEntry(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One Employee's line within a PayrollRun. basic_salary is a snapshot
    (from EmployeeSalaryProfile at run-creation time) so later profile
    edits don't rewrite payroll history. net_pay is NOT stored -- always
    computed live as basic_salary + sum(Bonus) - sum(Deduction) -
    sum(AdvanceInstallment) for this (employee_id, payroll_run_id) pair,
    same "computed, not a stored ledger" pattern used throughout (see
    routers/payroll_runs.py)."""

    __tablename__ = "payroll_entries"
    __table_args__ = (
        UniqueConstraint("payroll_run_id", "employee_id", name="uq_payroll_entries_run_employee"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    payroll_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payroll_runs.id"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    basic_salary: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
