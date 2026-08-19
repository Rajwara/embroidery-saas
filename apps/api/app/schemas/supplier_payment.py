import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

SupplierPaymentMethod = Literal["cash", "bank_transfer", "cheque", "other"]
SupplierPaymentAllocationType = Literal["purchase", "general", "advance", "unallocated"]


class SupplierPaymentAllocationCreateRequest(BaseModel):
    allocation_type: SupplierPaymentAllocationType
    # Required iff allocation_type == "purchase", forbidden otherwise --
    # enforced in the router.
    purchase_id: uuid.UUID | None = None
    amount: float


class SupplierPaymentCreateRequest(BaseModel):
    branch_id: uuid.UUID
    supplier_id: uuid.UUID
    payment_date: date
    amount: float
    payment_method: SupplierPaymentMethod
    notes: str | None = None
    # Must sum to exactly `amount` -- same rule as PaymentCreateRequest (see
    # [[domain_payment_allocation]] memory).
    allocations: list[SupplierPaymentAllocationCreateRequest]
    # payment_number excluded -- server-assigned, same pattern as Payment.payment_number.


class SupplierPaymentAllocationOut(BaseModel):
    id: uuid.UUID
    supplier_payment_id: uuid.UUID
    allocation_type: str
    purchase_id: uuid.UUID | None
    amount: float
    # Denormalized read-only convenience field -- joined in by the router
    # when purchase_id is set, not a stored column.
    purchase_number: str | None = None

    model_config = {"from_attributes": True}


class SupplierPaymentOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    supplier_id: uuid.UUID
    payment_number: str
    payment_date: date
    amount: float
    payment_method: str
    notes: str | None

    model_config = {"from_attributes": True}


class SupplierPaymentDetailOut(SupplierPaymentOut):
    """Used by GET /supplier-payments/{id} and create -- built manually by
    the router (no ORM relationships defined on SupplierPayment), not
    derived automatically from response_model attribute access."""

    allocations: list[SupplierPaymentAllocationOut]


class PurchaseBalanceOut(BaseModel):
    """How much of a purchase has been paid so far (sum of purchase-type
    SupplierPaymentAllocations across every supplier payment) and what
    remains -- computed live, not stored (same reasoning as
    InvoiceBalanceOut)."""

    purchase_id: uuid.UUID
    purchase_number: str
    total_amount: float
    paid_amount: float
    balance: float
