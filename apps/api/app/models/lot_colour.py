import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class LotColour(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One colour's slice of a Lot's total_suit_count. Free-text colour_name
    -- no shared master list yet."""

    __tablename__ = "lot_colours"

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    lot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lots.id"), nullable=False, index=True)
    colour_name: Mapped[str] = mapped_column(String(100), nullable=False)
    suit_count: Mapped[int] = mapped_column(Integer, nullable=False)
