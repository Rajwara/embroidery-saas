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
    # opening_balance + invoice totals - payment amounts, computed live the
    # same way _build_ledger's running total is (see routers/parties.py) --
    # opening_balance alone is just the starting number set at party
    # creation, not the party's actual outstanding balance today.
    current_balance: Decimal


class PartyDocsOut(PartyOut):
    """OpenAPI-documentation-only schema for GET/POST/PATCH /parties responses.

    NOT passed to response_model anywhere and NOT used with .model_validate()
    -- routers/parties.py's _serialize() still returns a PartyOut or
    PartyWithBalanceOut instance directly, unvalidated against this class.
    This exists solely to be referenced inside `responses={...}` dicts, which
    injects a schema into openapi.json for docs/codegen (e.g. orval) without
    FastAPI performing any response validation/filtering step -- that only
    happens when response_model is set, which is deliberately not the case
    here (see _serialize()'s docstring for why).

    opening_balance is OPTIONAL here (unlike PartyWithBalanceOut, where it's
    required) because whether the key is present on the wire depends on the
    caller's parties.see_money permission at request time -- OpenAPI's static
    schema format can't express that conditional, so "optional" is the
    closest accurate approximation.
    """

    opening_balance: Decimal | None = None
    current_balance: Decimal | None = None
