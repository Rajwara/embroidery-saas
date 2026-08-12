import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

JOB_STATUSES = ("draft", "allocated")


class ProductionJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One production job per LotColour -- createable only once the parent
    Lot is confirmed, allocated to a Design. Component-level targets and
    machine-level splits live in ProductionJobComponent /
    ProductionJobMachineAllocation (app/models/production_job_component.py,
    production_job_machine_allocation.py). status flips to "allocated" once
    every component has a machine split summing to its target_quantity --
    see routers/production_jobs.py's allocate endpoint."""

    __tablename__ = "production_jobs"
    __table_args__ = (
        UniqueConstraint("lot_colour_id", name="uq_production_jobs_lot_colour_id"),
        CheckConstraint("status IN ('draft', 'allocated')", name="ck_production_jobs_status"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    lot_colour_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lot_colours.id"), nullable=False, index=True)
    design_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("designs.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
