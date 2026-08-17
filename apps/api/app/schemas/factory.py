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
    lot_number_prefix: str | None = None
    challan_number_prefix: str | None = None
    invoice_number_prefix: str | None = None
    payment_number_prefix: str | None = None
    purchase_number_prefix: str | None = None
    expense_number_prefix: str | None = None
    notification_from_name: str | None = None
    notification_from_email: str | None = None
    notification_reply_to_email: str | None = None


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
    lot_number_prefix: str
    challan_number_prefix: str
    invoice_number_prefix: str
    payment_number_prefix: str
    purchase_number_prefix: str
    expense_number_prefix: str
    next_lot_number: int
    next_challan_number: int
    next_invoice_number: int
    next_payment_number: int
    next_purchase_number: int
    next_expense_number: int
    notification_from_name: str
    notification_from_email: str
    notification_reply_to_email: str | None

    model_config = {"from_attributes": True}
