"""scheduled report settings rls

Revision ID: d4e8b2c6a9f1
Revises: c02046852de3
Create Date: 2026-08-13 15:59:30.000000

Enables RLS on scheduled_report_settings (same strict pattern as every
other tenant-scoped table -- see e650e40e66c3). No new permission codes --
managing scheduled reports reuses the existing reports.view/reports.export
codes (view to list, export to create/edit/delete, matching the "export"
code's existing role assignments in permissions_catalog.py without adding
a narrower "reports.schedule" permission for one settings screen).

The worker's /internal/* endpoints that read across all tenants (see
routers/scheduled_reports.py) are authenticated by a shared secret, not a
user session, and explicitly SET LOCAL app.tenant_id per tenant in a loop
rather than bypassing RLS -- so this table's RLS policy applies to every
access path, including the internal one.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'd4e8b2c6a9f1'
down_revision: Union[str, None] = 'c02046852de3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

STRICT_TABLES = ["scheduled_report_settings"]

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

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_report_settings TO app_user;")


def downgrade() -> None:
    op.execute("REVOKE ALL ON scheduled_report_settings FROM app_user;")

    for table in reversed(STRICT_TABLES):
        op.execute(DROP_STRICT_POLICY.format(table=table))
