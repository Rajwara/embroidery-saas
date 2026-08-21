import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Purchase(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A bill from a Supplier. purchase_number is server-generated the same
    way as Lot.lot_number (see Factory.next_purchase_number). Line items
    are plain description/quantity/unit_price for now -- no InventoryItem
    FK yet, since that schema doesn't exist until Phase 4. "purchases
    update inventory" (ROADMAP.md item 8) is explicitly a forward link:
    Phase 4 wires the actual stock-transaction creation once InventoryItem
    exists, not this slice."""

    __tablename__ = "purchases"
    __table_args__ = (
        UniqueConstraint("tenant_id", "purchase_number", name="uq_purchases_tenant_purchase_number"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("branches.id"), nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("suppliers.id"), nullable=False, index=True)
    purchase_number: Mapped[str] = mapped_column(String(20), nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Mirrors Invoice.due_date -- optional, set at purchase-creation, used
    # to bucket a supplier's purchases into paid/pending/overdue.
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
