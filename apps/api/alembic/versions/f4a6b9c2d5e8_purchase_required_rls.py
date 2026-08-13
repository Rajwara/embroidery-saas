"""purchase required rls

Revision ID: f4a6b9c2d5e8
Revises: e0fd43de22a0
Create Date: 2026-08-13 12:38:00.000000

Enables RLS on the new purchase_required table (same strict pattern as
every other tenant-scoped table -- see e650e40e66c3). No new permission
codes -- purchase_required is gated behind the existing inventory.*
permissions (it's part of inventory management, not a separate module).
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'f4a6b9c2d5e8'
down_revision: Union[str, None] = 'e0fd43de22a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

STRICT_TABLES = ["purchase_required"]

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


def upgrade() -> None:
    for table in STRICT_TABLES:
        op.execute(STRICT_POLICY.format(table=table))

    # Belt-and-suspenders explicit grant -- redundant with e650e40e66c3's
    # ALTER DEFAULT PRIVILEGES (which already covers tables created by the
    # migrations-owner role), kept for the same reason 9bcabe9dff2c kept its.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_required TO app_user;")


def downgrade() -> None:
    op.execute("REVOKE ALL ON purchase_required FROM app_user;")

    for table in reversed(STRICT_TABLES):
        op.execute(DROP_STRICT_POLICY.format(table=table))
