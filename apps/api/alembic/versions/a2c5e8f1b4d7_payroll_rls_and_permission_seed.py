"""payroll rls and permission seed

Revision ID: a2c5e8f1b4d7
Revises: 5aab5b813c52
Create Date: 2026-08-13 12:50:00.000000

Enables RLS on the 7 new payroll tables (same strict pattern as every
other tenant-scoped table -- see e650e40e66c3) and bulk-inserts the 4 new
payroll.* permission codes (the rest of PERMISSION_CATALOG is already
seeded by earlier migrations -- hardcoded here, not imported, so this
migration stays correct regardless of future edits to
permissions_catalog.py).
"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a2c5e8f1b4d7'
down_revision: Union[str, None] = '5aab5b813c52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

STRICT_TABLES = [
    "payroll_runs",
    "advances",
    "bonuses",
    "deductions",
    "employee_salary_profiles",
    "payroll_entries",
    "advance_installments",
]

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
    ("payroll.view", "View payroll"),
    ("payroll.create", "Create payroll runs, bonuses, deductions, advances"),
    ("payroll.approve", "Approve payroll runs"),
    ("payroll.export", "Export payroll data"),
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
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON "
        "payroll_runs, advances, bonuses, deductions, employee_salary_profiles, "
        "payroll_entries, advance_installments TO app_user;"
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
            for code, description in NEW_PERMISSIONS
        ],
    )


def downgrade() -> None:
    codes_sql = ", ".join(f"'{code}'" for code, _ in NEW_PERMISSIONS)
    op.execute(f"DELETE FROM permissions WHERE code IN ({codes_sql});")

    op.execute(
        "REVOKE ALL ON payroll_runs, advances, bonuses, deductions, employee_salary_profiles, "
        "payroll_entries, advance_installments FROM app_user;"
    )

    for table in reversed(STRICT_TABLES):
        op.execute(DROP_STRICT_POLICY.format(table=table))
