import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

REPORT_TYPES = ("financial_summary",)
FREQUENCIES = ("weekly", "monthly")


class ScheduledReportSetting(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A tenant's request to have a report emailed on a recurring cadence.

    "weekly" always means Monday; "monthly" always means the 1st of the
    month -- no day-of-week/day-of-month picker in this first pass, to keep
    the Celery beat check simple (a single daily tick asking "is today the
    day for this setting"). last_sent_at is compared against today's date,
    not a timestamp diff, so a beat tick that runs more than once on the
    same day never double-sends.
    """

    __tablename__ = "scheduled_report_settings"
    __table_args__ = (
        CheckConstraint("report_type IN ('financial_summary')", name="ck_scheduled_report_settings_report_type"),
        CheckConstraint("frequency IN ('weekly', 'monthly')", name="ck_scheduled_report_settings_frequency"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("branches.id"), nullable=True)
    report_type: Mapped[str] = mapped_column(String(30), nullable=False)
    frequency: Mapped[str] = mapped_column(String(10), nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
