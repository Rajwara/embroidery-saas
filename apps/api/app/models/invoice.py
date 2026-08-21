import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Invoice(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A bill to a Party. invoice_number is server-generated the same way
    as Lot.lot_number / DeliveryChallan.challan_number (see
    Factory.next_invoice_number). Paid/unpaid status is not stored here --
    it's derived from Payment/PaymentAllocation sums (Phase 3 item 5),
    computed not tracked, same reasoning as Machine Profitability in
    Phase 5."""

    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "invoice_number", name="uq_invoices_tenant_invoice_number"),
        CheckConstraint(
            "promised_payment_method IN ('cash', 'bank_transfer', 'cheque', 'other')",
            name="ck_invoices_promised_payment_method",
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("branches.id"), nullable=False)
    party_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parties.id"), nullable=False, index=True)
    invoice_number: Mapped[str] = mapped_column(String(20), nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # The party's latest promise of when they'll pay, distinct from
    # due_date: due_date is the original invoice terms (set once, at
    # creation), promised_payment_date is mutable and gets updated whenever
    # the party renegotiates after missing a date -- see PATCH /invoices/{id}.
    promised_payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # How the party said they'll pay -- same value set as Payment.payment_method,
    # mutable for the same renegotiation reason as promised_payment_date.
    promised_payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
