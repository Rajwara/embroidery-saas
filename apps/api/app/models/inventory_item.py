import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class InventoryItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A stock-tracked item (whole-unit only, no partial cones -- ROADMAP.md
    item 1). current_stock is never stored -- always computed live as the
    sum of this item's StockTransaction.quantity (signed delta), same
    "computed, not a stored ledger" pattern used throughout Phase 3."""

    __tablename__ = "inventory_items"

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("branches.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    minimum_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
