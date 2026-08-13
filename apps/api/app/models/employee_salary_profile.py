import uuid

from sqlalchemy import ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class EmployeeSalaryProfile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One employee's standard monthly salary baseline -- snapshotted onto
    each PayrollEntry at that run's creation time so a later profile edit
    doesn't silently change past payroll history."""

    __tablename__ = "employee_salary_profiles"

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employees.id"), nullable=False, unique=True, index=True
    )
    basic_salary: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
