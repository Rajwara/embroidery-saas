import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UserPermissionOverride(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Lets a specific user's effective permissions differ from what their
    role(s) alone would grant. 'deny' always wins over any role grant or
    explicit grant during resolution (see app/permissions.py)."""

    __tablename__ = "user_permission_overrides"
    __table_args__ = (
        UniqueConstraint("user_id", "permission_id", name="uq_user_permission_override"),
        CheckConstraint("effect IN ('grant', 'deny')", name="ck_user_permission_override_effect"),
    )

    # Denormalized from user_id -> users.tenant_id: RLS needs a direct column
    # to filter on, same as employees/branches carrying their own tenant_id.
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    permission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("permissions.id"), nullable=False)
    effect: Mapped[str] = mapped_column(String(10), nullable=False)
