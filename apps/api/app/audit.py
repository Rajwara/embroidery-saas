"""
Audit trail write-path. Explicit call-site helper, not a SQLAlchemy session
event -- actor/IP/user-agent aren't available inside a session event without
a new contextvar subsystem this codebase has no precedent for, and
update_role's permission-codes reassignment / assign_role's m2m mutations
would still need per-relationship special-casing regardless of mechanism.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog


def client_meta(request: Request) -> tuple[str | None, str | None]:
    """IP + user-agent extraction. Was auth.py's private _client_meta;
    pulled out here once a fourth call site (roles/parties/suppliers)
    crossed this codebase's established three-instance duplication
    threshold."""
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return ip, user_agent


def _jsonable(value: Any) -> Any:
    """Recursively converts values JSONB can't natively store (Decimal,
    uuid.UUID, date/datetime) so call sites can pass raw dicts straight
    through without remembering to convert them first."""
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def record_audit(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | None,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """
    Stages one AuditLog row via db.add() -- does NOT call db.commit().
    Callers MUST call this BEFORE their own db.commit(), inside the same
    transaction where set_tenant_context() is already active (from
    get_current_user/require_permission's dependency chain). audit_log's
    RLS policy has a strict WITH CHECK, and db.commit() reverts
    app.tenant_id to an empty string afterward (SET LOCAL scope ends at
    commit) -- inserting after commit raises an invalid-uuid-syntax error.
    See app/db.py's set_tenant_context docstring.
    """
    db.add(
        AuditLog(
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=_jsonable(old_values) if old_values else old_values,
            new_values=_jsonable(new_values) if new_values else new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
