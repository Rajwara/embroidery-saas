import uuid
from decimal import Decimal

from pydantic import BaseModel


class SupplierCreateRequest(BaseModel):
    name: str
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    tax_id: str | None = None
    opening_balance: Decimal = Decimal("0")
    notes: str | None = None
    # is_active intentionally omitted -- always starts True.


class SupplierUpdateRequest(BaseModel):
    # PATCH semantics: None means "don't touch this field", matching
    # schemas/roles.py's RoleUpdateRequest convention.
    name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    tax_id: str | None = None
    opening_balance: Decimal | None = None
    notes: str | None = None
    is_active: bool | None = None


class SupplierOut(BaseModel):
    """Returned when the caller does NOT have suppliers.see_money."""

    id: uuid.UUID
    name: str
    contact_person: str | None
    phone: str | None
    email: str | None
    address: str | None
    city: str | None
    tax_id: str | None
    notes: str | None
    is_active: bool
    # opening_balance deliberately absent -- key is not present in the
    # response at all, not null, so "no permission" is never confusable
    # with "value is zero/unset" on the wire.

    model_config = {"from_attributes": True}


class SupplierWithBalanceOut(SupplierOut):
    """Returned when the caller DOES have suppliers.see_money."""

    opening_balance: Decimal
    # opening_balance + purchase totals - supplier payment amounts,
    # computed live the same way _build_ledger's running total is (see
    # routers/suppliers.py).
    current_balance: Decimal
    # Bulk-computed by routers/suppliers.py's _purchase_status_summaries,
    # mirroring Party's _invoice_status_summaries -- zero on every endpoint
    # except list_suppliers. paid_purchases_amount sums each paid
    # purchase's total; pending/overdue amounts sum outstanding balance.
    paid_purchases_count: int = 0
    paid_purchases_amount: float = 0.0
    pending_purchases_count: int = 0
    pending_purchases_amount: float = 0.0
    overdue_purchases_count: int = 0
    overdue_purchases_amount: float = 0.0


class SupplierDocsOut(SupplierOut):
    """OpenAPI-documentation-only schema for GET/POST/PATCH /suppliers
    responses -- same reasoning as PartyDocsOut in schemas/party.py. Not used
    for response_model or .model_validate(), only inside `responses={...}`.
    """

    opening_balance: Decimal | None = None
    current_balance: Decimal | None = None
    paid_purchases_count: int | None = None
    paid_purchases_amount: float | None = None
    pending_purchases_count: int | None = None
    pending_purchases_amount: float | None = None
    overdue_purchases_count: int | None = None
    overdue_purchases_amount: float | None = None
