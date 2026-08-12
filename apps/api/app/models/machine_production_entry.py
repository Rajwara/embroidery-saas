import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

SHIFTS = ("morning", "evening", "night")
ENTRY_STATUSES = ("pending", "approved", "rejected")


class MachineProductionEntry(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A single shift's logged production against one
    ProductionJobMachineAllocation (component + machine pair from Phase 2
    item 5). Multiple entries per machine+shift are expected -- this is a
    running log, not one row per shift. Starts "pending"; only counts
    toward machine/employee performance and component completion once
    "approved" (see routers/production_entries.py's approve endpoint, which
    also caps the sum of approved entries for an allocation at its
    allocated_quantity). Single source of truth for both machine history
    and operator/helper profile -- Machine/Employee Performance Views
    (Phase 2 item 9) read straight from this table, no separate history
    tables."""

    __tablename__ = "machine_production_entries"
    __table_args__ = (
        CheckConstraint("shift IN ('morning', 'evening', 'night')", name="ck_production_entries_shift"),
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')", name="ck_production_entries_status"
        ),
        CheckConstraint("quantity > 0", name="ck_production_entries_quantity_positive"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    production_job_machine_allocation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("production_job_machine_allocations.id"), nullable=False, index=True
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift: Mapped[str] = mapped_column(String(20), nullable=False)
    operator_employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employees.id"), nullable=False, index=True
    )
    helper_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employees.id"), nullable=True, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
