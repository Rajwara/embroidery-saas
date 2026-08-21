import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

ADVANCE_STATUSES = ("pending", "approved", "rejected")


class Advance(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A cash advance requested by/for an Employee, independent of any
    specific PayrollRun. Starts "pending" and needs approval (see
    routers/payroll.py's /advances/{id}/approve and /reject, same
    single-permission-reuse pattern as production_entries.approve and
    purchase_required's inventory.edit) before it can be recovered against
    payroll -- add_advance_installment rejects installments against a
    non-"approved" advance. Editable (amount/advance_date/reason) only
    while "pending" (see AdvanceUpdateRequest); once approved or rejected
    it's a closed record, same as PurchaseRequired's terminal states.
    remaining_balance is never stored -- always computed live as amount
    minus the sum of this advance's AdvanceInstallment rows (same
    "computed, not a stored ledger" pattern used throughout). Recovery is
    staff-initiated per payroll run (see AdvanceInstallment), not an
    automatic fixed monthly deduction -- ROADMAP.md's "carry forward
    automatically until recovered" is read here as "the balance just
    persists, unforced, until someone records a recovery," matching this
    codebase's "no automatic consumption" pattern from inventory."""

    __tablename__ = "advances"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_advances_amount_positive"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_advances_status"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    advance_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
