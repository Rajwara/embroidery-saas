import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# Scope doc §6.1 -- fixed component-letter codes, same 5 component types as
# LotComponent (app/models/lot_component.py's COMPONENT_TYPES).
COMPONENT_LETTERS: dict[str, str] = {
    "front": "F",
    "back": "B",
    "sleeves": "S",
    "trouser": "T",
    "dupatta": "D",
}


class DesignVariant(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One component+colourway of a Design. component_letter and
    variant_code are server-computed at creation time (see
    routers/designs.py) and stored, not recomputed on read."""

    __tablename__ = "design_variants"
    __table_args__ = (
        UniqueConstraint(
            "design_id", "component_type", "colour_variant_code", name="uq_design_variants_natural_key"
        ),
        CheckConstraint(
            "component_type IN ('front', 'back', 'sleeves', 'trouser', 'dupatta')",
            name="ck_design_variants_component_type",
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    design_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("designs.id"), nullable=False, index=True)
    component_type: Mapped[str] = mapped_column(String(20), nullable=False)
    component_letter: Mapped[str] = mapped_column(String(1), nullable=False)
    colour_variant_code: Mapped[str] = mapped_column(String(50), nullable=False)
    variant_code: Mapped[str] = mapped_column(String(80), nullable=False)
    # Nullable -- existing variants predate this field and need backfilling
    # via update_design_variant. Stitch-based invoice pricing (Phase 3 item
    # 3) always uses this declared count, never a machine-reported stitch
    # figure (no such figure is tracked anywhere -- MachineProductionEntry
    # only records piece quantity, not stitches).
    stitch_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
