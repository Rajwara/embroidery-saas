"""advance approval

Revision ID: c9f4a2e7d1b8
Revises: b7e3d9f2a6c4
Create Date: 2026-08-21 14:00:00.000000

Adds a pending/approved/rejected approval gate to Advance (previously
created already-active with no status at all). Existing rows are
backfilled to "approved" so advances already recovered against payroll
stay valid -- see upgrade()'s data migration step. No new permission
codes needed: approve/reject reuse the existing payroll.approve
permission, same as PayrollRun's own /approve endpoint.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c9f4a2e7d1b8'
down_revision: Union[str, None] = 'b7e3d9f2a6c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("advances", sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"))
    op.add_column("advances", sa.Column("rejection_reason", sa.String(length=500), nullable=True))
    op.create_check_constraint(
        "ck_advances_status",
        "advances",
        "status IN ('pending', 'approved', 'rejected')",
    )

    # Every advance that existed before this migration was created back
    # when there was no approval gate at all -- treat them as already
    # approved so pre-existing recovery installments (AdvanceInstallment
    # rows against them) stay valid instead of retroactively pointing at a
    # "pending" advance.
    op.execute("UPDATE advances SET status = 'approved'")

    op.alter_column("advances", "status", server_default=None)


def downgrade() -> None:
    op.drop_constraint("ck_advances_status", "advances", type_="check")
    op.drop_column("advances", "rejection_reason")
    op.drop_column("advances", "status")
