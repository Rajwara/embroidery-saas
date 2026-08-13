import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

TransactionType = Literal["receipt", "issue", "adjustment"]
ReferenceType = Literal["purchase", "production_job"]


class InventoryItemCreateRequest(BaseModel):
    branch_id: uuid.UUID
    name: str
    unit: str
    category: str | None = None
    minimum_threshold: int = 0
    notes: str | None = None


class InventoryItemUpdateRequest(BaseModel):
    # PATCH semantics: None means "don't touch this field", matching
    # schemas/branch.py's BranchUpdateRequest convention.
    branch_id: uuid.UUID | None = None
    name: str | None = None
    unit: str | None = None
    category: str | None = None
    minimum_threshold: int | None = None
    notes: str | None = None
    is_active: bool | None = None


class InventoryItemOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    name: str
    unit: str
    category: str | None
    minimum_threshold: int
    notes: str | None
    is_active: bool
    # Denormalized read-only convenience field -- summed by the router from
    # StockTransaction rows, not a stored column (see InventoryItem's
    # docstring for why).
    current_stock: int
    is_below_threshold: bool

    model_config = {"from_attributes": True}


class StockTransactionCreateRequest(BaseModel):
    transaction_type: TransactionType
    # Always a positive count from the caller's point of view -- "how many
    # units" -- regardless of type. The router determines the sign to
    # store: receipt is +quantity, issue is -quantity. adjustment also
    # takes a positive magnitude here plus an explicit direction, since an
    # adjustment can go either way (see adjustment_direction).
    quantity: int
    adjustment_direction: Literal["increase", "decrease"] | None = None
    transaction_date: date
    reference_type: ReferenceType | None = None
    reference_id: uuid.UUID | None = None
    notes: str | None = None


class StockTransactionOut(BaseModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    transaction_type: str
    quantity: int
    transaction_date: date
    reference_type: str | None
    reference_id: uuid.UUID | None
    notes: str | None

    model_config = {"from_attributes": True}


class PurchaseRequiredOut(BaseModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    status: str
    requested_quantity: int
    notes: str | None
    # Denormalized read-only convenience fields -- joined in by the router,
    # not stored columns (same reasoning as ProductionJobOut's enrichment).
    item_name: str
    item_unit: str
    current_stock: int

    model_config = {"from_attributes": True}


class AdvancePurchaseRequiredRequest(BaseModel):
    # Only meaningful on the final purchased -> received transition -- lets
    # staff record a different quantity than requested_quantity if that's
    # what actually arrived. Ignored on every earlier transition.
    received_quantity: int | None = None
