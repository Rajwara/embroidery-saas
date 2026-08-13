import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

PAYMENT_METHODS = ("cash", "bank_transfer", "cheque", "other")


class Payment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Money received from a Party. payment_number is server-generated the
    same way as Lot.lot_number (see Factory.next_payment_number). The full
    `amount` must be split across one or more PaymentAllocation rows
    summing to exactly this amount -- see routers/payments.py's
    create_payment and [[domain_payment_allocation]] memory."""

    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "payment_number", name="uq_payments_tenant_payment_number"),
        CheckConstraint("payment_method IN ('cash', 'bank_transfer', 'cheque', 'other')", name="ck_payments_method"),
        CheckConstraint("amount > 0", name="ck_payments_amount_positive"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("branches.id"), nullable=False)
    party_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parties.id"), nullable=False, index=True)
    payment_number: Mapped[str] = mapped_column(String(20), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
