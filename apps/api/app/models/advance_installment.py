import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AdvanceInstallment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One recovery installment against an Advance, tied to the PayrollRun
    it was recovered within -- this is what reduces Advance's live-computed
    remaining_balance and what a PayrollEntry's net_pay subtracts."""

    __tablename__ = "advance_installments"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_advance_installments_amount_positive"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    advance_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("advances.id"), nullable=False, index=True)
    payroll_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payroll_runs.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    installment_date: Mapped[date] = mapped_column(Date, nullable=False)
