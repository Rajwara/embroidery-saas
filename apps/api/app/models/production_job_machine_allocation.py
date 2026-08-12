import uuid

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ProductionJobMachineAllocation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One machine's share of a ProductionJobComponent's target_quantity.
    Auto-split evenly across the chosen machines when the allocate endpoint
    is called with no explicit quantities (see routers/production_jobs.py's
    _split_evenly), or set to caller-supplied quantities that must sum to
    the component's target_quantity -- enforced in the router, not a DB
    constraint (same reasoning as LotColour.suit_count vs
    Lot.total_suit_count). Re-calling allocate for a component fully
    replaces its existing rows rather than layering on top."""

    __tablename__ = "production_job_machine_allocations"
    __table_args__ = (
        UniqueConstraint(
            "production_job_component_id", "machine_id", name="uq_job_allocations_component_machine"
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    production_job_component_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("production_job_components.id"), nullable=False, index=True
    )
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False, index=True)
    allocated_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
