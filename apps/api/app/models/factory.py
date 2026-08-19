import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Factory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Company profile. 1:1 with Tenant in Stage 1 (unique tenant_id)."""

    __tablename__ = "factories"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="Pakistan")
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tax_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="PKR")
    fiscal_year_start_month: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Next value to assign for Lot.lot_number (e.g. "LOT-000001") --
    # incremented under a row lock inside the same transaction as the Lot
    # insert (see routers/lots.py) so concurrent creates serialize correctly.
    next_lot_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Same pattern as next_lot_number, for DeliveryChallan.challan_number
    # (e.g. "CH-000001") -- see routers/delivery_challans.py.
    next_challan_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Same pattern, for Invoice.invoice_number (e.g. "INV-000001") -- see
    # routers/invoices.py.
    next_invoice_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Same pattern, for Payment.payment_number (e.g. "PMT-000001") -- see
    # routers/payments.py.
    next_payment_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Same pattern, for Purchase.purchase_number (e.g. "PUR-000001") -- see
    # routers/purchases.py.
    next_purchase_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Same pattern, for Expense.expense_number (e.g. "EXP-000001") -- see
    # routers/expenses.py.
    next_expense_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Same pattern, for SupplierPayment.payment_number (e.g. "SPMT-000001")
    # -- see routers/supplier_payments.py.
    next_supplier_payment_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Prefixes are editable (Settings > Company Profile); the counters above
    # are not -- resetting a counter risks reusing a number already issued,
    # so only the prefix half of "LOT-000001" is configurable. Each router
    # reads its prefix from here instead of a hardcoded literal.
    lot_number_prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="LOT")
    challan_number_prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="CH")
    invoice_number_prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="INV")
    payment_number_prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="PMT")
    purchase_number_prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="PUR")
    expense_number_prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="EXP")
    supplier_payment_number_prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="SPMT")

    # Settings > Notifications. Every outbound system email (password reset,
    # invite, scheduled report delivery) reads its "From" header from here
    # instead of the constant that used to be hardcoded and duplicated in
    # app/email.py and apps/worker/tasks.py.
    notification_from_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Embroidery SaaS")
    notification_from_email: Mapped[str] = mapped_column(
        String(255), nullable=False, default="onboarding@resend.dev"
    )
    # Optional -- Resend omits reply-to entirely when unset, so replies go
    # nowhere by default rather than to a hardcoded address no one reads.
    notification_reply_to_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
