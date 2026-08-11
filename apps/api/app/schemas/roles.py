import uuid
from typing import Literal

from pydantic import BaseModel


class PermissionOut(BaseModel):
    id: uuid.UUID
    code: str
    description: str

    model_config = {"from_attributes": True}


class RoleOut(BaseModel):
    id: uuid.UUID
    name: str
    is_template: bool
    permissions: list[PermissionOut]

    model_config = {"from_attributes": True}


class RoleCreateRequest(BaseModel):
    name: str
    permission_codes: list[str] = []


class RoleUpdateRequest(BaseModel):
    name: str | None = None
    permission_codes: list[str] | None = None


class PermissionOverrideRequest(BaseModel):
    permission_code: str
    # None clears any existing override for this permission (falls back to
    # pure role-derived resolution).
    effect: Literal["grant", "deny"] | None = None


class EffectivePermissionsResponse(BaseModel):
    user_id: uuid.UUID
    is_super_admin: bool
    permissions: list[str]
