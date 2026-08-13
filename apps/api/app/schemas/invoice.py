import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

PricingType = Literal["per_suit", "stitch_based"]


class InvoiceLineItemCreateRequest(BaseModel):
    description: str
    pricing_type: PricingType
    quantity: int
    # per_suit only:
    unit_price: float | None = None
    # stitch_based only -- stitch_count is looked up from this variant at
    # creation time and snapshotted, not accepted directly from the client.
    design_variant_id: uuid.UUID | None = None
    rate_per_thousand_stitches: float | None = None


class InvoiceCreateRequest(BaseModel):
    branch_id: uuid.UUID
    party_id: uuid.UUID
    invoice_date: date
    due_date: date | None = None
    notes: str | None = None
    lines: list[InvoiceLineItemCreateRequest]
    # invoice_number excluded -- server-assigned, same pattern as Lot.lot_number.


class InvoiceLineItemOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    description: str
    pricing_type: str
    quantity: int
    unit_price: float | None
    design_variant_id: uuid.UUID | None
    stitch_count: int | None
    rate_per_thousand_stitches: float | None
    line_total: float

    model_config = {"from_attributes": True}


class InvoiceOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    party_id: uuid.UUID
    invoice_number: str
    invoice_date: date
    due_date: date | None
    notes: str | None
    # Denormalized read-only convenience field -- summed by the router
    # (see routers/invoices.py's _to_invoice_out), not a stored column.
    # Paid/unpaid status isn't tracked here at all (see Invoice's
    # docstring) -- that's derived from Payment/PaymentAllocation, Phase 3
    # item 5, not yet built.
    total_amount: float

    model_config = {"from_attributes": True}


class InvoiceDetailOut(InvoiceOut):
    """Used by GET /invoices/{id} and create -- built manually by the
    router (no ORM relationships defined on Invoice), not derived
    automatically from response_model attribute access."""

    lines: list[InvoiceLineItemOut]
