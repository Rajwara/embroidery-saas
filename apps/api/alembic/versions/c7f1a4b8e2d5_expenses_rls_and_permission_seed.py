"""expenses rls and permission seed

Revision ID: c7f1a4b8e2d5
Revises: 9d304d622bad
Create Date: 2026-08-13 12:22:00.000000

Enables RLS on the new expenses table (same strict pattern as every other
tenant-scoped table -- see e650e40e66c3) and bulk-inserts the 3 new
expenses.* permission codes (the rest of PERMISSION_CATALOG is already
seeded by earlier migrations -- hardcoded here, not imported, so this
migration stays correct regardless of future edits to
permissions_catalog.py).
"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c7f1a4b8e2d5'
down_revision: Union[str, None] = '9d304d622bad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

STRICT_TABLES = ["expenses"]

STRICT_POLICY = """
    ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
    ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON {table}
        USING (tenant_id = current_setting('app.tenant_id')::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
"""

DROP_STRICT_POLICY = """
    DROP POLICY IF EXISTS tenant_isolation ON {table};
    ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;
"""

NEW_PERMISSIONS = [
    ("expenses.view", "View expenses"),
    ("expenses.create", "Create expenses"),
    ("expenses.export", "Export expense data"),
]

permissions_table = sa.table(
    "permissions",
    sa.column("id", sa.UUID()),
    sa.column("code", sa.String()),
    sa.column("description", sa.String()),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    for table in STRICT_TABLES:
        op.execute(STRICT_POLICY.format(table=table))

    # Belt-and-suspenders explicit grant -- redundant with e650e40e66c3's
    # ALTER DEFAULT PRIVILEGES (which already covers tables created by the
    # migrations-owner role), kept for the same reason 9bcabe9dff2c kept its.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO app_user;")

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
            for code, description in NEW_PERMISSIONS
        ],
    )


def downgrade() -> None:
    codes_sql = ", ".join(f"'{code}'" for code, _ in NEW_PERMISSIONS)
    op.execute(f"DELETE FROM permissions WHERE code IN ({codes_sql});")

    op.execute("REVOKE ALL ON expenses FROM app_user;")

    for table in reversed(STRICT_TABLES):
        op.execute(DROP_STRICT_POLICY.format(table=table))
