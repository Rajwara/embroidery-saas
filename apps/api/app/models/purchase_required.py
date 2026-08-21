import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# The exact 6-stage pipeline from ROADMAP.md item 3, "purchase_required"
# being the initial auto-created state, not a separate trigger event.
PURCHASE_REQUIRED_STATUSES = (
    "purchase_required",
    "pending_approval",
    "approved",
    "ordered",
    "purchased",
    "received",
)

# "Open" = still needs attention -- not yet received, and not rejected.
# "rejected" is a side-branch reachable from any non-terminal stage, not
# part of the linear PURCHASE_REQUIRED_STATUSES pipeline above.
PURCHASE_REQUIRED_CLOSED_STATUSES = ("received", "rejected")


class PurchaseRequired(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Auto-created (see routers/inventory.py's create_stock_transaction)
    the moment an InventoryItem's current_stock drops below its
    minimum_threshold, provided no other open (non-"received",
    non-"rejected") PurchaseRequired already exists for that item -- never
    more than one open request per item at a time. Advances one stage at a
    time via routers/purchase_required.py's /advance endpoint (strictly
    linear, no skipping or going back) -- PURCHASE_REQUIRED_STATUSES stays
    exactly that linear pipeline, so "rejected" is validated separately by
    the check constraint below rather than appended to the tuple, which
    would break /advance's .index()-based "next stage" logic. Reaching
    "received" auto-creates a "receipt" StockTransaction for
    received_quantity (defaults to requested_quantity if not overridden at
    that final step). "rejected" is a side-branch reachable from any
    non-terminal stage via /reject, not part of the linear pipeline."""

    __tablename__ = "purchase_required"
    __table_args__ = (
        CheckConstraint(
            "status IN ('purchase_required', 'pending_approval', 'approved', 'ordered', 'purchased', 'received', 'rejected')",
            name="ck_purchase_required_status",
        ),
        CheckConstraint("requested_quantity > 0", name="ck_purchase_required_quantity_positive"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inventory_items.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="purchase_required")
    requested_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
