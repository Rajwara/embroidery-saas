import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Expense(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A standalone factory expense (rent, utilities, maintenance, etc --
    category is free text, no fixed list). expense_number is
    server-generated the same way as Lot.lot_number (see
    Factory.next_expense_number). Unlike Invoice/Purchase, a single flat
    amount -- no line items, per ROADMAP.md's plain "Expense schema +
    Expense List/Entry" (no line-item breakdown mentioned)."""

    __tablename__ = "expenses"
    __table_args__ = (
        UniqueConstraint("tenant_id", "expense_number", name="uq_expenses_tenant_expense_number"),
        CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("branches.id"), nullable=False)
    expense_number: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
