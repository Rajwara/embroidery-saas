"""
Effective-permission resolution. FastAPI-free (mirrors the security.py /
dependencies.py split) -- callers handle is_super_admin/is_platform_admin
bypasses; this module only resolves what roles + overrides actually grant,
which keeps it safe to expose verbatim via GET /me/permissions.

Computed fresh per request, not embedded in the JWT: this is an
access-control feature where revoking a user's access (e.g. a fired
employee) must take effect immediately, not after their token happens to
expire.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Permission, Role, User, UserPermissionOverride
from app.models.tenant import role_permissions, user_roles


def get_effective_permissions(db: Session, user: User) -> set[str]:
    # Joined through Role (not just the junction tables) so Role's existing
    # strict RLS policy filters out any cross-tenant row as defense in depth,
    # even though user_roles/role_permissions themselves carry no policy.
    role_codes = set(
        db.execute(
            select(Permission.code)
            .join(role_permissions, role_permissions.c.permission_id == Permission.id)
            .join(Role, Role.id == role_permissions.c.role_id)
            .join(user_roles, user_roles.c.role_id == Role.id)
            .where(user_roles.c.user_id == user.id)
        ).scalars()
    )

    overrides = db.execute(
        select(Permission.code, UserPermissionOverride.effect)
        .join(UserPermissionOverride, UserPermissionOverride.permission_id == Permission.id)
        .where(UserPermissionOverride.user_id == user.id)
    ).all()
    granted = {code for code, effect in overrides if effect == "grant"}
    denied = {code for code, effect in overrides if effect == "deny"}

    # deny always wins, even over an explicit grant override.
    return (role_codes | granted) - denied


def user_has_permission(db: Session, user: User, code: str) -> bool:
    return code in get_effective_permissions(db, user)
