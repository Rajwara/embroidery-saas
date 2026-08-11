import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db, set_tenant_context
from app.dependencies import get_current_super_admin, get_current_user, require_permission
from app.models import Permission, Role, User, UserPermissionOverride
from app.permissions import get_effective_permissions
from app.schemas.roles import (
    EffectivePermissionsResponse,
    PermissionOut,
    PermissionOverrideRequest,
    RoleCreateRequest,
    RoleOut,
    RoleUpdateRequest,
)

router = APIRouter()


def _resolve_permissions(db: Session, codes: list[str]) -> list[Permission]:
    if not codes:
        return []
    permissions = db.query(Permission).filter(Permission.code.in_(codes)).all()
    found_codes = {p.code for p in permissions}
    missing = set(codes) - found_codes
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=f"unknown_permission_codes: {sorted(missing)}"
        )
    return permissions


@router.get("/permissions", response_model=list[PermissionOut])
def list_permissions(
    db: Session = Depends(get_db), _user: User = Depends(require_permission("roles.view"))
) -> list[Permission]:
    return db.query(Permission).order_by(Permission.code).all()


@router.get("/roles", response_model=list[RoleOut])
def list_roles(
    db: Session = Depends(get_db), _user: User = Depends(require_permission("roles.view"))
) -> list[Role]:
    return db.query(Role).order_by(Role.name).all()


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("roles.create")),
) -> Role:
    role = Role(tenant_id=user.tenant_id, name=payload.name)
    role.permissions = _resolve_permissions(db, payload.permission_codes)
    db.add(role)
    db.commit()
    # db.commit() ends the transaction that set_tenant_context() scoped its
    # SET LOCAL to -- re-establish it before the refresh below re-queries
    # roles under RLS. See app/db.py's set_tenant_context docstring.
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(role)
    return role


@router.get("/roles/{role_id}", response_model=RoleOut)
def get_role(
    role_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("roles.view")),
) -> Role:
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="role_not_found")
    return role


@router.patch("/roles/{role_id}", response_model=RoleOut)
def update_role(
    role_id: uuid.UUID,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("roles.edit")),
) -> Role:
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="role_not_found")

    if payload.name is not None:
        role.name = payload.name
    if payload.permission_codes is not None:
        role.permissions = _resolve_permissions(db, payload.permission_codes)

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(role)
    return role


@router.post("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_200_OK)
def assign_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("roles.edit")),
) -> dict:
    target_user = db.get(User, user_id)
    role = db.get(Role, role_id)
    if target_user is None or role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_or_role_not_found")

    if role not in target_user.roles:
        target_user.roles.append(role)
        db.commit()

    return {"detail": "role_assigned"}


@router.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_200_OK)
def unassign_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("roles.edit")),
) -> dict:
    target_user = db.get(User, user_id)
    role = db.get(Role, role_id)
    if target_user is None or role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_or_role_not_found")

    if role in target_user.roles:
        target_user.roles.remove(role)
        db.commit()

    return {"detail": "role_unassigned"}


@router.get("/users/{user_id}/permissions", response_model=EffectivePermissionsResponse)
def get_user_permissions(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("roles.view")),
) -> EffectivePermissionsResponse:
    target_user = db.get(User, user_id)
    if target_user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")

    permissions = get_effective_permissions(db, target_user)
    return EffectivePermissionsResponse(
        user_id=target_user.id,
        is_super_admin=target_user.is_super_admin,
        permissions=sorted(permissions),
    )


@router.put("/users/{user_id}/permission-overrides", response_model=EffectivePermissionsResponse)
def set_permission_override(
    user_id: uuid.UUID,
    payload: PermissionOverrideRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_super_admin),
) -> EffectivePermissionsResponse:
    target_user = db.get(User, user_id)
    if target_user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")

    permission = db.query(Permission).filter(Permission.code == payload.permission_code).first()
    if permission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="permission_not_found")

    existing = (
        db.query(UserPermissionOverride)
        .filter_by(user_id=target_user.id, permission_id=permission.id)
        .first()
    )

    if payload.effect is None:
        if existing is not None:
            db.delete(existing)
            db.commit()
    elif existing is not None:
        existing.effect = payload.effect
        db.commit()
    else:
        db.add(
            UserPermissionOverride(
                tenant_id=target_user.tenant_id,
                user_id=target_user.id,
                permission_id=permission.id,
                effect=payload.effect,
            )
        )
        db.commit()

    # Any of the three branches above may have committed, which ends the
    # transaction set_tenant_context() scoped its SET LOCAL to -- re-establish
    # it before the RLS-protected query below. See app/db.py's docstring.
    set_tenant_context(db, str(target_user.tenant_id))
    permissions = get_effective_permissions(db, target_user)
    return EffectivePermissionsResponse(
        user_id=target_user.id,
        is_super_admin=target_user.is_super_admin,
        permissions=sorted(permissions),
    )


@router.get("/me/permissions", response_model=EffectivePermissionsResponse)
def get_my_permissions(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> EffectivePermissionsResponse:
    permissions = get_effective_permissions(db, user)
    return EffectivePermissionsResponse(
        user_id=user.id, is_super_admin=user.is_super_admin, permissions=sorted(permissions)
    )
