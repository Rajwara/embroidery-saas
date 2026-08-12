import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ProductionJobComponent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One component-type's production target within a ProductionJob,
    copied from the parent LotColour's confirmed LotComponent at job
    creation time (see routers/production_jobs.py's create_production_job --
    every LotComponent is guaranteed confirmed_quantity is not None there,
    since job creation requires the parent Lot to already be "confirmed",
    which itself requires every LotComponent to be confirmed).
    Machine-level splits live in ProductionJobMachineAllocation."""

    __tablename__ = "production_job_components"
    __table_args__ = (
        UniqueConstraint(
            "production_job_id", "component_type", name="uq_production_job_components_job_type"
        ),
        CheckConstraint(
            "component_type IN ('front', 'back', 'sleeves', 'trouser', 'dupatta')",
            name="ck_production_job_components_type",
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    production_job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("production_jobs.id"), nullable=False, index=True
    )
    component_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
