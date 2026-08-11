import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

SUIT_TYPES = ("one_piece", "two_piece", "three_piece")
LOT_STATUSES = ("pending_breakdown", "pending_confirmation", "confirmed")


class Lot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A batch of garments a Party sends in for embroidery. suit_type
    determines which LotComponent types generate per colour -- see
    app/models/lot_component.py's COMPONENTS_BY_SUIT_TYPE."""

    __tablename__ = "lots"
    __table_args__ = (
        UniqueConstraint("tenant_id", "lot_number", name="uq_lots_tenant_lot_number"),
        CheckConstraint(
            "suit_type IN ('one_piece', 'two_piece', 'three_piece')", name="ck_lots_suit_type"
        ),
        CheckConstraint(
            "status IN ('pending_breakdown', 'pending_confirmation', 'confirmed')", name="ck_lots_status"
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("branches.id"), nullable=False)
    party_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parties.id"), nullable=False)
    lot_number: Mapped[str] = mapped_column(String(20), nullable=False)
    received_date: Mapped[date] = mapped_column(Date, nullable=False)
    suit_type: Mapped[str] = mapped_column(String(20), nullable=False)
    total_suit_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending_breakdown")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
