"""purchase required reject

Revision ID: b7e3d9f2a6c4
Revises: a4f8c1e6b3d2
Create Date: 2026-08-21 12:00:00.000000

Adds a "rejected" side-branch to PurchaseRequired, reachable from any
non-terminal stage via the new POST /purchase-required/{id}/reject
endpoint (reuses the existing inventory.edit permission, same as
/advance -- no new permission code needed). rejection_reason mirrors
MachineProductionEntry.rejection_reason (String(500), nullable).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b7e3d9f2a6c4'
down_revision: Union[str, None] = 'a4f8c1e6b3d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("purchase_required", sa.Column("rejection_reason", sa.String(length=500), nullable=True))

    op.drop_constraint("ck_purchase_required_status", "purchase_required", type_="check")
    op.create_check_constraint(
        "ck_purchase_required_status",
        "purchase_required",
        "status IN ('purchase_required', 'pending_approval', 'approved', 'ordered', 'purchased', 'received', 'rejected')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_purchase_required_status", "purchase_required", type_="check")
    op.create_check_constraint(
        "ck_purchase_required_status",
        "purchase_required",
        "status IN ('purchase_required', 'pending_approval', 'approved', 'ordered', 'purchased', 'received')",
    )

    op.drop_column("purchase_required", "rejection_reason")
