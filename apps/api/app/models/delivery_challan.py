import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DeliveryChallan(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A delivery run back to a Party -- one or more DeliveryChallanLine
    rows, each a quantity of one deliverable unit (shirt/dupatta/trouser)
    for one LotColour. challan_number is server-generated the same way as
    Lot.lot_number (see Factory.next_challan_number)."""

    __tablename__ = "delivery_challans"
    __table_args__ = (
        UniqueConstraint("tenant_id", "challan_number", name="uq_delivery_challans_tenant_challan_number"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("branches.id"), nullable=False)
    party_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parties.id"), nullable=False, index=True)
    challan_number: Mapped[str] = mapped_column(String(20), nullable=False)
    delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
