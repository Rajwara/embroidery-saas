import uuid
from datetime import date

from pydantic import BaseModel


class PurchaseLineItemCreateRequest(BaseModel):
    description: str
    quantity: int
    unit_price: float
    # Optional -- when set, creating the Purchase auto-generates a
    # "receipt" StockTransaction for this line's quantity against that
    # item (see routers/purchases.py). This is the actual "purchases
    # update inventory" wiring Phase 3 deferred until InventoryItem existed.
    inventory_item_id: uuid.UUID | None = None


class PurchaseCreateRequest(BaseModel):
    branch_id: uuid.UUID
    supplier_id: uuid.UUID
    purchase_date: date
    due_date: date | None = None
    notes: str | None = None
    lines: list[PurchaseLineItemCreateRequest]
    # purchase_number excluded -- server-assigned, same pattern as Lot.lot_number.


class PurchaseLineItemOut(BaseModel):
    id: uuid.UUID
    purchase_id: uuid.UUID
    description: str
    quantity: int
    unit_price: float
    line_total: float
    inventory_item_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class PurchaseOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    supplier_id: uuid.UUID
    purchase_number: str
    purchase_date: date
    due_date: date | None
    notes: str | None
    # Denormalized read-only convenience field -- summed by the router, not
    # a stored column (same reasoning as InvoiceOut.total_amount).
    total_amount: float

    model_config = {"from_attributes": True}


class PurchaseDetailOut(PurchaseOut):
    """Used by GET /purchases/{id} and create -- built manually by the
    router (no ORM relationships defined on Purchase), not derived
    automatically from response_model attribute access."""

    lines: list[PurchaseLineItemOut]
