"""inventory rls and permission seed

Revision ID: e9b2c5d8f1a3
Revises: d61d94d92379
Create Date: 2026-08-13 12:30:00.000000

Enables RLS on the 2 new inventory tables (same strict pattern as every
other tenant-scoped table -- see e650e40e66c3) and bulk-inserts the 4 new
inventory.* permission codes (the rest of PERMISSION_CATALOG is already
seeded by earlier migrations -- hardcoded here, not imported, so this
migration stays correct regardless of future edits to
permissions_catalog.py).
"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e9b2c5d8f1a3'
down_revision: Union[str, None] = 'd61d94d92379'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

STRICT_TABLES = ["inventory_items", "stock_transactions"]

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
    ("inventory.view", "View inventory"),
    ("inventory.create", "Create inventory items and stock transactions"),
    ("inventory.edit", "Edit inventory items"),
    ("inventory.export", "Export inventory data"),
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
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items, stock_transactions TO app_user;")

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

    op.execute("REVOKE ALL ON inventory_items, stock_transactions FROM app_user;")

    for table in reversed(STRICT_TABLES):
        op.execute(DROP_STRICT_POLICY.format(table=table))
