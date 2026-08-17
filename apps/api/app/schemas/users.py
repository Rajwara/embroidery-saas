import uuid

from pydantic import BaseModel


class UserRoleOut(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_super_admin: bool
    roles: list[UserRoleOut]

    model_config = {"from_attributes": True}


class UserInviteRequest(BaseModel):
    email: str
    full_name: str
    role_ids: list[uuid.UUID] = []


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    is_active: bool | None = None
