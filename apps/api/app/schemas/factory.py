import uuid

from pydantic import BaseModel


class FactoryCreateRequest(BaseModel):
    name: str
    legal_name: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str = "Pakistan"
    phone: str | None = None
    email: str | None = None
    tax_id: str | None = None
    logo_url: str | None = None
    currency: str = "PKR"
    fiscal_year_start_month: int = 1
    # is_active intentionally omitted -- always starts True.


class FactoryUpdateRequest(BaseModel):
    name: str | None = None
    legal_name: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None
    tax_id: str | None = None
    logo_url: str | None = None
    currency: str | None = None
    fiscal_year_start_month: int | None = None
    is_active: bool | None = None


class FactoryOut(BaseModel):
    id: uuid.UUID
    name: str
    legal_name: str | None
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    country: str
    phone: str | None
    email: str | None
    tax_id: str | None
    logo_url: str | None
    currency: str
    fiscal_year_start_month: int
    is_active: bool

    model_config = {"from_attributes": True}
