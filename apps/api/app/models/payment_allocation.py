import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# The 4 allocation destinations, per ROADMAP.md item 5's exact wording:
# "against one invoice, split across many, general against balance,
# advance, unallocated".
ALLOCATION_TYPES = ("invoice", "general", "advance", "unallocated")


class PaymentAllocation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One slice of a Payment's amount. invoice_id is required when
    allocation_type == "invoice" and forbidden otherwise -- enforced in
    routers/payments.py, not a DB constraint (same reasoning as
    InvoiceLineItem's per_suit/stitch_based field pairing). An invoice-type
    allocation is capped so the sum of all invoice-type allocations across
    every payment can't exceed that invoice's total_amount -- see
    [[domain_payment_allocation]] memory."""

    __tablename__ = "payment_allocations"
    __table_args__ = (
        CheckConstraint(
            "allocation_type IN ('invoice', 'general', 'advance', 'unallocated')",
            name="ck_payment_allocations_type",
        ),
        CheckConstraint("amount > 0", name="ck_payment_allocations_amount_positive"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    payment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payments.id"), nullable=False, index=True)
    allocation_type: Mapped[str] = mapped_column(String(20), nullable=False)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("invoices.id"), nullable=True, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
