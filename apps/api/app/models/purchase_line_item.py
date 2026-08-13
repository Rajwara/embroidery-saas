import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PurchaseLineItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One line on a Purchase. line_total is computed once at creation and
    stored, not derived live -- same reasoning as InvoiceLineItem.

    inventory_item_id is nullable and was added in Phase 4 (it couldn't
    exist when Purchase was first built in Phase 3, since InventoryItem
    didn't exist yet -- see this model's own original docstring note on
    "purchases update inventory" being an explicit forward link, Purchase's
    class docstring in models/purchase.py). When set,
    creating the Purchase auto-generates a "receipt" StockTransaction for
    this line's quantity against that item (see routers/purchases.py) --
    this is the actual wiring the Phase 3 slice deferred."""

    __tablename__ = "purchase_line_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_purchase_line_items_quantity_positive"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    purchase_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchases.id"), nullable=False, index=True)
    inventory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("inventory_items.id"), nullable=True, index=True
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
