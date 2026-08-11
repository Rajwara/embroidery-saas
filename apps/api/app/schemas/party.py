import uuid
from decimal import Decimal

from pydantic import BaseModel


class PartyCreateRequest(BaseModel):
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


class PartyUpdateRequest(BaseModel):
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


class PartyOut(BaseModel):
    """Returned when the caller does NOT have parties.see_money."""

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


class PartyWithBalanceOut(PartyOut):
    """Returned when the caller DOES have parties.see_money."""

    opening_balance: Decimal
