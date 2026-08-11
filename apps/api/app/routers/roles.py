import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
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


@router.get("/permissions", response_model=list[PermissionOut], operation_id="listPermissions")
def list_permissions(
    db: Session = Depends(get_db), _user: User = Depends(require_permission("roles.view"))
) -> list[Permission]:
    return db.query(Permission).order_by(Permission.code).all()


@router.get("/roles", response_model=list[RoleOut], operation_id="listRoles")
def list_roles(
    db: Session = Depends(get_db), _user: User = Depends(require_permission("roles.view"))
) -> list[Role]:
    return db.query(Role).order_by(Role.name).all()


@router.post(
    "/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED, operation_id="createRole"
)
def create_role(
    payload: RoleCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("roles.create")),
) -> Role:
    role = Role(tenant_id=user.tenant_id, name=payload.name)
    role.permissions = _resolve_permissions(db, payload.permission_codes)
    db.add(role)
    db.flush()  # populate role.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="role",
        entity_id=role.id,
        new_values={"name": role.name, "permission_codes": sorted(p.code for p in role.permissions)},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    # db.commit() ends the transaction that set_tenant_context() scoped its
    # SET LOCAL to -- re-establish it before the refresh below re-queries
    # roles under RLS. See app/db.py's set_tenant_context docstring.
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(role)
    return role


@router.get("/roles/{role_id}", response_model=RoleOut, operation_id="getRole")
def get_role(
    role_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("roles.view")),
) -> Role:
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="role_not_found")
    return role


@router.patch("/roles/{role_id}", response_model=RoleOut, operation_id="updateRole")
def update_role(
    role_id: uuid.UUID,
    payload: RoleUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("roles.edit")),
) -> Role:
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="role_not_found")

    old_values: dict = {}
    new_values: dict = {}

    if payload.name is not None and payload.name != role.name:
        old_values["name"] = role.name
        new_values["name"] = payload.name
        role.name = payload.name

    if payload.permission_codes is not None:
        old_codes = sorted(p.code for p in role.permissions)
        role.permissions = _resolve_permissions(db, payload.permission_codes)
        new_codes = sorted(p.code for p in role.permissions)
        if old_codes != new_codes:
            old_values["permission_codes"] = old_codes
            new_values["permission_codes"] = new_codes

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="role",
            entity_id=role.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(role)
    return role


@router.post(
    "/users/{user_id}/roles/{role_id}", status_code=status.HTTP_200_OK, operation_id="assignRole"
)
def assign_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("roles.edit")),
) -> dict:
    target_user = db.get(User, user_id)
    role = db.get(Role, role_id)
    if target_user is None or role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_or_role_not_found")

    if role not in target_user.roles:
        target_user.roles.append(role)
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="role_assigned",
            entity_type="user",
            entity_id=target_user.id,
            new_values={"role_id": role.id, "role_name": role.name},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.commit()

    return {"detail": "role_assigned"}


@router.delete(
    "/users/{user_id}/roles/{role_id}",
    status_code=status.HTTP_200_OK,
    operation_id="unassignRole",
)
def unassign_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("roles.edit")),
) -> dict:
    target_user = db.get(User, user_id)
    role = db.get(Role, role_id)
    if target_user is None or role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_or_role_not_found")

    if role in target_user.roles:
        target_user.roles.remove(role)
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="role_unassigned",
            entity_type="user",
            entity_id=target_user.id,
            old_values={"role_id": role.id, "role_name": role.name},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.commit()

    return {"detail": "role_unassigned"}


@router.get(
    "/users/{user_id}/permissions",
    response_model=EffectivePermissionsResponse,
    operation_id="getUserPermissions",
)
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


@router.put(
    "/users/{user_id}/permission-overrides",
    response_model=EffectivePermissionsResponse,
    operation_id="setPermissionOverride",
)
def set_permission_override(
    user_id: uuid.UUID,
    payload: PermissionOverrideRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_super_admin),
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
    old_effect = existing.effect if existing is not None else None
    ip_address, user_agent = client_meta(request)

    if payload.effect is None:
        if existing is not None:
            db.delete(existing)
            record_audit(
                db,
                tenant_id=target_user.tenant_id,
                actor_user_id=admin.id,
                action="permission_override_cleared",
                entity_type="user",
                entity_id=target_user.id,
                old_values={"permission_code": payload.permission_code, "effect": old_effect},
                ip_address=ip_address,
                user_agent=user_agent,
            )
            db.commit()
    elif existing is not None:
        if payload.effect != old_effect:
            existing.effect = payload.effect
            record_audit(
                db,
                tenant_id=target_user.tenant_id,
                actor_user_id=admin.id,
                action="permission_override_updated",
                entity_type="user",
                entity_id=target_user.id,
                old_values={"permission_code": payload.permission_code, "effect": old_effect},
                new_values={"permission_code": payload.permission_code, "effect": payload.effect},
                ip_address=ip_address,
                user_agent=user_agent,
            )
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
        record_audit(
            db,
            tenant_id=target_user.tenant_id,
            actor_user_id=admin.id,
            action="permission_override_created",
            entity_type="user",
            entity_id=target_user.id,
            new_values={"permission_code": payload.permission_code, "effect": payload.effect},
            ip_address=ip_address,
            user_agent=user_agent,
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


@router.get(
    "/me/permissions",
    response_model=EffectivePermissionsResponse,
    operation_id="getMyPermissions",
)
def get_my_permissions(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> EffectivePermissionsResponse:
    permissions = get_effective_permissions(db, user)
    return EffectivePermissionsResponse(
        user_id=user.id, is_super_admin=user.is_super_admin, permissions=sorted(permissions)
    )
