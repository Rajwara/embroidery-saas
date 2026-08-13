import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

UnitType = Literal["shirt", "dupatta", "trouser"]


class DeliveryChallanLineCreateRequest(BaseModel):
    lot_colour_id: uuid.UUID
    unit_type: UnitType
    quantity: int


class DeliveryChallanCreateRequest(BaseModel):
    branch_id: uuid.UUID
    party_id: uuid.UUID
    delivery_date: date
    notes: str | None = None
    lines: list[DeliveryChallanLineCreateRequest]
    # challan_number excluded -- server-assigned, same pattern as Lot.lot_number.


class DeliveryChallanOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    party_id: uuid.UUID
    challan_number: str
    delivery_date: date
    notes: str | None

    model_config = {"from_attributes": True}


class DeliveryChallanLineOut(BaseModel):
    id: uuid.UUID
    delivery_challan_id: uuid.UUID
    lot_colour_id: uuid.UUID
    unit_type: str
    quantity: int
    # Denormalized read-only convenience fields -- joined in by the router,
    # not stored columns (same reasoning as ProductionJobOut's enrichment).
    lot_id: uuid.UUID
    lot_number: str
    colour_name: str

    model_config = {"from_attributes": True}


class DeliveryChallanDetailOut(DeliveryChallanOut):
    """Used by GET /delivery-challans/{id} and create -- built manually by
    the router (no ORM relationships defined on DeliveryChallan), not
    derived automatically from response_model attribute access."""

    lines: list[DeliveryChallanLineOut]


class ReconciliationRow(BaseModel):
    """One deliverable unit's received/produced/delivered/remaining state
    for one LotColour (see routers/delivery_challans.py's
    _reconciliation_for_colour). "shirt" is the front+back+sleeves roll-up
    (see [[domain_production_job]] memory); dupatta/trouser are standalone.
    remaining is capped by BOTH what was received from the client AND what
    approved production has actually finished -- see
    [[domain_delivery_challan]] memory for why."""

    lot_colour_id: uuid.UUID
    lot_id: uuid.UUID
    lot_number: str
    colour_name: str
    unit_type: str
    received: int
    approved_produced: int
    delivered: int
    remaining: int
