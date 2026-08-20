"""Resolves a DesignVariant's stitch_count for a (design_id, component_type)
pair -- used to convert produced piece quantity into total stitches wherever
production output is reported (Machine/Employee Performance, Production
Summary, Machine Cost report).

LotColour.colour_name is free text with no shared master list and doesn't
map to DesignVariant.colour_variant_code (see DesignVariant's docstring), so
colour can't be used to disambiguate which variant applies to a given piece
of production. This resolves by design + component only, taking the first
variant (by creation order) that has a stitch_count set and ignoring colour
entirely. If a design has multiple colourways of the same component with
genuinely different stitch counts, this can pick either one -- an accepted
tradeoff over adding a real colour-to-variant link, which would be a bigger
schema/workflow change (see project memory on stitch count resolution).
"""

import uuid

from sqlalchemy.orm import Session

from app.models import DesignVariant


def resolve_stitch_counts(
    db: Session, pairs: set[tuple[uuid.UUID, str]]
) -> dict[tuple[uuid.UUID, str], int | None]:
    """pairs: {(design_id, component_type), ...}. Returns the same keys,
    each mapped to a stitch count or None if no variant has one set yet."""
    if not pairs:
        return {}
    design_ids = {design_id for design_id, _ in pairs}
    variants = (
        db.query(DesignVariant)
        .filter(
            DesignVariant.design_id.in_(design_ids),
            DesignVariant.stitch_count.isnot(None),
        )
        .order_by(DesignVariant.design_id, DesignVariant.component_type, DesignVariant.created_at)
        .all()
    )
    resolved: dict[tuple[uuid.UUID, str], int] = {}
    for variant in variants:
        key = (variant.design_id, variant.component_type)
        resolved.setdefault(key, variant.stitch_count)
    return {pair: resolved.get(pair) for pair in pairs}
