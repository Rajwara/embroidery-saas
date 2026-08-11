"""roles rls and permission catalog seed

Revision ID: b69b75fdf221
Revises: 891756917d92
Create Date: 2026-08-11 13:11:08.641646

Enables RLS on user_permission_overrides (same strict pattern as every
other tenant-scoped table -- see e650e40e66c3) and bulk-inserts the
permission catalog from app.permissions_catalog. The catalog is the single
source of truth so this migration and app/seed.py's role-template creation
never drift out of sync.

The blanket ALTER DEFAULT PRIVILEGES from e650e40e66c3 has no FOR ROLE
clause, so it already keys off whichever role executes it -- since Alembic
always runs via MIGRATIONS_DATABASE_URL (the owner role), any table that
role creates (including this migration's user_permission_overrides) is
already auto-granted to app_user. The explicit GRANT below is redundant
defense, not strictly required, kept for the same reason e650e40e66c3 kept
its own belt-and-suspenders grants.
"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.permissions_catalog import PERMISSION_CATALOG

revision: str = 'b69b75fdf221'
down_revision: Union[str, None] = '891756917d92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

permissions_table = sa.table(
    "permissions",
    sa.column("id", sa.UUID()),
    sa.column("code", sa.String()),
    sa.column("description", sa.String()),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    op.execute("ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE user_permission_overrides FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON user_permission_overrides
            USING (tenant_id = current_setting('app.tenant_id')::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
        """
    )

    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON user_permission_overrides TO app_user;"
    )

    now = datetime.now(timezone.utc)
    op.bulk_insert(
        permissions_table,
        [
            {
                "id": uuid.uuid4(),
                "code": code,
                "description": description,
                "created_at": now,
                "updated_at": now,
            }
            for code, description in PERMISSION_CATALOG
        ],
    )


def downgrade() -> None:
    # PERMISSION_CATALOG codes are a static, developer-controlled list (no
    # external input), so plain interpolation here is safe -- same approach
    # e650e40e66c3 uses for its STRICT_POLICY.format(table=table).
    codes_sql = ", ".join(f"'{code}'" for code, _ in PERMISSION_CATALOG)
    op.execute(f"DELETE FROM permissions WHERE code IN ({codes_sql});")

    op.execute("REVOKE ALL ON user_permission_overrides FROM app_user;")

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON user_permission_overrides;")
    op.execute("ALTER TABLE user_permission_overrides NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE user_permission_overrides DISABLE ROW LEVEL SECURITY;")
