import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Bonus(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One bonus line for one Employee within one PayrollRun. Summed live
    into that employee's PayrollEntry.net_pay, not stored there directly."""

    __tablename__ = "bonuses"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_bonuses_amount_positive"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    payroll_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payroll_runs.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
