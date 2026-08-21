"""purchase due date

Revision ID: d2a8f5c1e9b4
Revises: c9f4a2e7d1b8
Create Date: 2026-08-21 16:00:00.000000

Adds Purchase.due_date, mirroring Invoice.due_date -- needed so the
Suppliers list can bucket purchases into paid/pending/overdue the same
way the Parties list already does for invoices. Nullable/optional, same
as Invoice.due_date.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd2a8f5c1e9b4'
down_revision: Union[str, None] = 'c9f4a2e7d1b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("purchases", sa.Column("due_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("purchases", "due_date")
