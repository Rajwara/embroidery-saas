import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Deduction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One deduction line for one Employee within one PayrollRun (e.g.
    attendance penalty) -- distinct from AdvanceInstallment, which is
    specifically an advance recovery, not a generic deduction. Summed live
    into that employee's PayrollEntry.net_pay, not stored there directly."""

    __tablename__ = "deductions"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_deductions_amount_positive"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    payroll_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payroll_runs.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
