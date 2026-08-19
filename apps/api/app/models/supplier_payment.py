import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

SUPPLIER_PAYMENT_METHODS = ("cash", "bank_transfer", "cheque", "other")


class SupplierPayment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Money paid to a Supplier -- the credit-side counterpart to Purchase,
    same shape as Payment is to Invoice for Party. payment_number is
    server-generated the same way as Payment.payment_number (see
    Factory.next_supplier_payment_number). The full `amount` must be split
    across one or more SupplierPaymentAllocation rows summing to exactly
    this amount -- see routers/supplier_payments.py's create_supplier_payment
    and [[domain_payment_allocation]] memory (same rules, purchase instead
    of invoice)."""

    __tablename__ = "supplier_payments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "payment_number", name="uq_supplier_payments_tenant_payment_number"),
        CheckConstraint(
            "payment_method IN ('cash', 'bank_transfer', 'cheque', 'other')",
            name="ck_supplier_payments_method",
        ),
        CheckConstraint("amount > 0", name="ck_supplier_payments_amount_positive"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("branches.id"), nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("suppliers.id"), nullable=False, index=True)
    payment_number: Mapped[str] = mapped_column(String(20), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
