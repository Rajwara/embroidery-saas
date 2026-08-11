import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Design(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A reusable design-library entry (master pattern/style), independent
    of any Lot or Party. master_number is the factory's own user-entered
    catalog code -- unlike Lot.lot_number, it is not server-generated."""

    __tablename__ = "designs"
    __table_args__ = (
        UniqueConstraint("tenant_id", "master_number", name="uq_designs_tenant_master_number"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    master_number: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
