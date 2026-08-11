import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

SuitType = Literal["one_piece", "two_piece", "three_piece"]


class LotCreateRequest(BaseModel):
    branch_id: uuid.UUID
    party_id: uuid.UUID
    received_date: date
    suit_type: SuitType
    total_suit_count: int
    notes: str | None = None
    # lot_number/status excluded -- server-assigned / lifecycle-controlled.


class LotUpdateRequest(BaseModel):
    # PATCH semantics: None means "don't touch this field", matching
    # schemas/branch.py's BranchUpdateRequest convention.
    branch_id: uuid.UUID | None = None
    party_id: uuid.UUID | None = None
    received_date: date | None = None
    suit_type: SuitType | None = None
    total_suit_count: int | None = None
    notes: str | None = None
    # lot_number/status excluded -- immutable / lifecycle-controlled.


class LotOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    party_id: uuid.UUID
    lot_number: str
    received_date: date
    suit_type: str
    total_suit_count: int
    status: str
    notes: str | None

    model_config = {"from_attributes": True}


class LotColourCreateRequest(BaseModel):
    colour_name: str
    suit_count: int


class LotColourOut(BaseModel):
    id: uuid.UUID
    lot_id: uuid.UUID
    colour_name: str
    suit_count: int

    model_config = {"from_attributes": True}


class LotComponentConfirmRequest(BaseModel):
    confirmed_quantity: int


class LotComponentOut(BaseModel):
    id: uuid.UUID
    lot_colour_id: uuid.UUID
    component_type: str
    expected_quantity: int
    confirmed_quantity: int | None
    is_confirmed: bool

    model_config = {"from_attributes": True}


class LotColourWithComponentsOut(LotColourOut):
    components: list[LotComponentOut]


class LotDetailOut(LotOut):
    """Used by GET /lots/{id}, generate-components, and confirm -- built
    manually by the router (no ORM relationships defined on Lot/LotColour),
    not derived automatically from response_model attribute access."""

    colours: list[LotColourWithComponentsOut]
