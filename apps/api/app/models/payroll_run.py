import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

PAYROLL_RUN_STATUSES = ("draft", "approved")


class PayrollRun(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One branch's payroll for one calendar month. Creating a run
    generates one PayrollEntry per active Employee at that branch,
    snapshotting their EmployeeSalaryProfile.basic_salary at that moment.
    Bonus/Deduction/AdvanceInstallment rows can only be added while status
    is "draft" -- approve() locks the run (see routers/payroll_runs.py),
    which is what makes net_pay effectively frozen without needing a
    separate stored-snapshot mechanism (it's still computed live, but
    nothing can change the inputs once approved)."""

    __tablename__ = "payroll_runs"
    __table_args__ = (
        UniqueConstraint("tenant_id", "branch_id", "year", "month", name="uq_payroll_runs_tenant_branch_period"),
        CheckConstraint("status IN ('draft', 'approved')", name="ck_payroll_runs_status"),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_payroll_runs_month_range"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("branches.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    run_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
