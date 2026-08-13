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
