import uuid

from pydantic import BaseModel


class BranchCreateRequest(BaseModel):
    name: str
    code: str
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    is_head_office: bool = False
    # factory_id excluded -- server-derived (1:1 with tenant).
    # is_active excluded -- always starts True.


class BranchUpdateRequest(BaseModel):
    name: str | None = None
    code: str | None = None
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    is_head_office: bool | None = None
    is_active: bool | None = None
    # factory_id excluded -- immutable.


class BranchOut(BaseModel):
    id: uuid.UUID
    factory_id: uuid.UUID
    name: str
    code: str
    address: str | None
    city: str | None
    phone: str | None
    is_head_office: bool
    is_active: bool

    model_config = {"from_attributes": True}
