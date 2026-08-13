"""reports permission seed

Revision ID: c7d9a1e3f5b2
Revises: a2c5e8f1b4d7
Create Date: 2026-08-13 15:00:00.000000

Phase 5 reports are entirely computed from existing tenant-scoped tables
(already under RLS) -- no new tables, so this migration only bulk-inserts
the 2 new reports.* permission codes (hardcoded here, not imported from
permissions_catalog.py, matching every prior permission-seed migration's
reasoning for staying correct regardless of future catalog edits).
"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c7d9a1e3f5b2'
down_revision: Union[str, None] = 'a2c5e8f1b4d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PERMISSIONS = [
    ("reports.view", "View reports"),
    ("reports.export", "Export reports"),
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
