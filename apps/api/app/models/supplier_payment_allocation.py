import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# Same 4 allocation destinations as PaymentAllocation, "invoice" swapped for
# "purchase" -- against one purchase, split across many, general against
# balance, advance, unallocated.
SUPPLIER_PAYMENT_ALLOCATION_TYPES = ("purchase", "general", "advance", "unallocated")


class SupplierPaymentAllocation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One slice of a SupplierPayment's amount -- same shape as
    PaymentAllocation, purchase_id in place of invoice_id. purchase_id is
    required when allocation_type == "purchase" and forbidden otherwise --
    enforced in routers/supplier_payments.py, not a DB constraint (same
    reasoning as PaymentAllocation's invoice_id pairing). A purchase-type
    allocation is capped so the sum of all purchase-type allocations across
    every supplier payment can't exceed that purchase's total amount -- see
    [[domain_payment_allocation]] memory."""

    __tablename__ = "supplier_payment_allocations"
    __table_args__ = (
        CheckConstraint(
            "allocation_type IN ('purchase', 'general', 'advance', 'unallocated')",
            name="ck_supplier_payment_allocations_type",
        ),
        CheckConstraint("amount > 0", name="ck_supplier_payment_allocations_amount_positive"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    supplier_payment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("supplier_payments.id"), nullable=False, index=True
    )
    allocation_type: Mapped[str] = mapped_column(String(20), nullable=False)
    purchase_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("purchases.id"), nullable=True, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
