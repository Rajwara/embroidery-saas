import uuid

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db, set_tenant_context
from app.models import User
from app.permissions import user_has_permission
from app.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)
settings = get_settings()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decodes the access token, sets the RLS tenant context for the rest of this
    request's session, and fetches the current user. Every authenticated
    router should depend on this instead of bare get_db.
    """
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not_authenticated")

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    tenant_id = payload["tenant_id"]
    set_tenant_context(db, tenant_id)

    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    return user


def get_current_super_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_super_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="super_admin_required")
    return user


def require_permission(code: str):
    """FastAPI dependency factory for gating routes on a permission code
    (e.g. Depends(require_permission("parties.create"))). is_super_admin
    bypasses unconditionally; is_platform_admin does not -- that's a
    separate cross-tenant SaaS-admin concern, not an in-tenant override."""

    def dependency(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if user.is_super_admin:
            return user
        if not user_has_permission(db, user, code):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="permission_denied")
        return user

    return dependency


def require_internal_secret(x_internal_secret: str = Header(...)) -> None:
    """Gates apps/worker's machine-to-machine calls (scheduled report
    delivery has no human session to authenticate as a User). Compares
    against internal_api_secret, never a user JWT -- callers using this
    must set RLS tenant context themselves per-row/per-tenant, since there
    is no single authenticated tenant to derive it from."""
    if x_internal_secret != settings.internal_api_secret:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="invalid_internal_secret")
