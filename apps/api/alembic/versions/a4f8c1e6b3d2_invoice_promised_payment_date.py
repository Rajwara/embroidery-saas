"""invoice promised payment date

Revision ID: a4f8c1e6b3d2
Revises: 722905027434
Create Date: 2026-08-21 10:00:00.000000

Adds Invoice.promised_payment_date + promised_payment_method -- mutable
fields distinct from the fixed due_date, updated whenever the party
renegotiates after missing a date (see Invoice model docstring) -- and the
new invoices.edit / payments.edit permission codes needed to gate
PATCH /invoices/{id} and PATCH /payments/{id} (hardcoded here, not
imported from permissions_catalog.py, same reasoning as f2a7b5d9c3e1).
"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a4f8c1e6b3d2'
down_revision: Union[str, None] = '722905027434'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PERMISSIONS = [
    ("invoices.edit", "Edit invoices"),
    ("payments.edit", "Edit payments"),
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
    op.add_column("invoices", sa.Column("promised_payment_date", sa.Date(), nullable=True))
    op.add_column("invoices", sa.Column("promised_payment_method", sa.String(length=20), nullable=True))
    op.create_check_constraint(
        "ck_invoices_promised_payment_method",
        "invoices",
        "promised_payment_method IN ('cash', 'bank_transfer', 'cheque', 'other')",
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

    op.drop_constraint("ck_invoices_promised_payment_method", "invoices", type_="check")
    op.drop_column("invoices", "promised_payment_method")
    op.drop_column("invoices", "promised_payment_date")
