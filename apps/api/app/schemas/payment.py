import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

PaymentMethod = Literal["cash", "bank_transfer", "cheque", "other"]
AllocationType = Literal["invoice", "general", "advance", "unallocated"]


class PaymentAllocationCreateRequest(BaseModel):
    allocation_type: AllocationType
    # Required iff allocation_type == "invoice", forbidden otherwise --
    # enforced in the router.
    invoice_id: uuid.UUID | None = None
    amount: float


class PaymentCreateRequest(BaseModel):
    branch_id: uuid.UUID
    party_id: uuid.UUID
    payment_date: date
    amount: float
    payment_method: PaymentMethod
    notes: str | None = None
    # Must sum to exactly `amount` -- every rupee/dollar received lands in
    # some allocation, even if that's "unallocated" (see
    # [[domain_payment_allocation]] memory).
    allocations: list[PaymentAllocationCreateRequest]
    # payment_number excluded -- server-assigned, same pattern as Lot.lot_number.


class PaymentUpdateRequest(BaseModel):
    # PATCH semantics: None means "don't touch this field", matching
    # schemas/party.py's PartyUpdateRequest convention. amount/allocations
    # are deliberately not editable here -- changing amount would break the
    # invariant that allocations sum to exactly `amount` (see
    # [[domain_payment_allocation]] memory); that needs a dedicated re-split
    # flow, not a plain field PATCH.
    payment_date: date | None = None
    payment_method: PaymentMethod | None = None
    notes: str | None = None


class PaymentAllocationOut(BaseModel):
    id: uuid.UUID
    payment_id: uuid.UUID
    allocation_type: str
    invoice_id: uuid.UUID | None
    amount: float
    # Denormalized read-only convenience field -- joined in by the router
    # when invoice_id is set, not a stored column.
    invoice_number: str | None = None

    model_config = {"from_attributes": True}


class PaymentOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    party_id: uuid.UUID
    payment_number: str
    payment_date: date
    amount: float
    payment_method: str
    notes: str | None

    model_config = {"from_attributes": True}


class PaymentDetailOut(PaymentOut):
    """Used by GET /payments/{id} and create -- built manually by the
    router (no ORM relationships defined on Payment), not derived
    automatically from response_model attribute access."""

    allocations: list[PaymentAllocationOut]


class InvoiceBalanceOut(BaseModel):
    """How much of an invoice has been paid so far (sum of invoice-type
    PaymentAllocations across every payment) and what remains -- computed
    live, not stored (same reasoning as InvoiceOut.total_amount)."""

    invoice_id: uuid.UUID
    invoice_number: str
    total_amount: float
    paid_amount: float
    balance: float
