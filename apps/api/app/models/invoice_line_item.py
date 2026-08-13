import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

PRICING_TYPES = ("per_suit", "stitch_based")


class InvoiceLineItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One priced line on an Invoice. Two pricing modes (scope doc /
    ROADMAP.md item 3):

    - per_suit: line_total = quantity * unit_price.
    - stitch_based: line_total = quantity * stitch_count * rate_per_thousand_stitches / 1000
      (industry-standard "rate per 1000 stitches" convention). stitch_count
      is snapshotted from DesignVariant.stitch_count at creation time (see
      routers/invoices.py) -- never recomputed from a machine-reported
      figure, per ROADMAP.md's explicit "never the machine-reported count"
      -- and no such figure exists anywhere anyway (MachineProductionEntry
      only records piece quantity).

    line_total is computed once at creation and stored, not derived live
    on every read -- once issued, an invoice's amounts shouldn't drift if
    referenced data (e.g. the design variant's stitch_count) changes later.
    """

    __tablename__ = "invoice_line_items"
    __table_args__ = (
        CheckConstraint("pricing_type IN ('per_suit', 'stitch_based')", name="ck_invoice_line_items_pricing_type"),
        CheckConstraint("quantity > 0", name="ck_invoice_line_items_quantity_positive"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    pricing_type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    # per_suit only:
    unit_price: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    # stitch_based only:
    design_variant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("design_variants.id"), nullable=True, index=True
    )
    stitch_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rate_per_thousand_stitches: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    # Always populated, both pricing types:
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
