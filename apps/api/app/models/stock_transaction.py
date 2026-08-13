import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

TRANSACTION_TYPES = ("receipt", "issue", "adjustment")
# Polymorphic reference to whatever caused this transaction -- e.g. a
# Purchase (auto-created receipt, see routers/purchases.py) or a
# ProductionJob (staff manually tags an issue for their own tracking, NOT
# automatic consumption -- ROADMAP.md §28 explicitly excludes that from
# Stage 1). Purely informational; nothing enforces referential integrity
# across the polymorphic pair since the target table varies.
REFERENCE_TYPES = ("purchase", "production_job")


class StockTransaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One stock movement. quantity is a SIGNED delta -- positive increases
    stock, negative decreases it -- so an item's current stock is always
    just sum(quantity) over its transactions, never stored separately.
    Every movement is a mandatory transaction row (ROADMAP.md item 1): there
    is no other way to change an item's stock level."""

    __tablename__ = "stock_transactions"
    __table_args__ = (
        CheckConstraint("transaction_type IN ('receipt', 'issue', 'adjustment')", name="ck_stock_transactions_type"),
        CheckConstraint("quantity != 0", name="ck_stock_transactions_quantity_nonzero"),
        CheckConstraint(
            "reference_type IS NULL OR reference_type IN ('purchase', 'production_job')",
            name="ck_stock_transactions_reference_type",
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inventory_items.id"), nullable=False, index=True
    )
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    reference_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
