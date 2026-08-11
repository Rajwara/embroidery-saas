import uuid
from typing import Literal

from pydantic import BaseModel

ComponentType = Literal["front", "back", "sleeves", "trouser", "dupatta"]


class DesignCreateRequest(BaseModel):
    master_number: str
    name: str
    notes: str | None = None


class DesignUpdateRequest(BaseModel):
    # PATCH semantics: None means "don't touch this field", matching
    # schemas/branch.py's BranchUpdateRequest convention.
    name: str | None = None
    notes: str | None = None
    # master_number excluded -- immutable.


class DesignOut(BaseModel):
    id: uuid.UUID
    master_number: str
    name: str
    notes: str | None

    model_config = {"from_attributes": True}


class DesignVariantCreateRequest(BaseModel):
    component_type: ComponentType
    colour_variant_code: str


class DesignVariantOut(BaseModel):
    id: uuid.UUID
    design_id: uuid.UUID
    component_type: str
    component_letter: str
    colour_variant_code: str
    variant_code: str

    model_config = {"from_attributes": True}


class DesignDetailOut(DesignOut):
    """Used by GET /designs/{id} -- built manually by the router (no ORM
    relationship defined on Design), not derived automatically from
    response_model attribute access."""

    variants: list[DesignVariantOut]
