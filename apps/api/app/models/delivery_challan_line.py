import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# The 3 deliverable units, per scope doc: "complete shirt" is the
# front+back+sleeves roll-up (see [[domain_production_job]] memory's shirt
# roll-up), always present for every suit_type. Dupatta/trouser are
# standalone units, only deliverable when the parent LotColour actually
# has that LotComponent (see COMPONENTS_BY_SUIT_TYPE in lot_component.py).
UNIT_TYPES = ("shirt", "dupatta", "trouser")


class DeliveryChallanLine(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One deliverable-unit quantity within a DeliveryChallan. quantity is
    validated at create time (see routers/delivery_challans.py) against
    the same reconciliation math as GET .../reconciliation: received
    (confirmed LotComponent quantity) capped by approved production
    (approved MachineProductionEntry sum), minus quantity already
    delivered on other challans for the same (lot_colour_id, unit_type)."""

    __tablename__ = "delivery_challan_lines"
    __table_args__ = (
        CheckConstraint("unit_type IN ('shirt', 'dupatta', 'trouser')", name="ck_delivery_challan_lines_unit_type"),
        CheckConstraint("quantity > 0", name="ck_delivery_challan_lines_quantity_positive"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    delivery_challan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("delivery_challans.id"), nullable=False, index=True
    )
    lot_colour_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lot_colours.id"), nullable=False, index=True)
    unit_type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
