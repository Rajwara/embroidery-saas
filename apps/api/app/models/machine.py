import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Machine(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "machines"

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("branches.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    machine_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    number_of_heads: Mapped[int | None] = mapped_column(Integer, nullable=True)
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # "Who's assigned to this machine right now" -- an explicit, persistent
    # staffing record the user sets directly from the Machine Detail page's
    # "Assign work" section, deliberately separate from MachineProductionEntry
    # (which records actual produced quantity, not who's currently staffed).
    # All nullable together: an empty assignment is "nothing currently
    # assigned" and is what the reactivate-to-Active prompt checks for.
    current_shift: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_operator_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employees.id"), nullable=True
    )
    current_helper_employee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"), nullable=True)
    current_lot_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("lots.id"), nullable=True)
