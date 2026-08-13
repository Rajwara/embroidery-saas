"""
Scheduled Report Settings (Phase 5 item 4): lets a tenant have a report
emailed on a recurring cadence. Two distinct audiences hit this module:

- Tenant users manage their own settings via the normal permission-gated
  CRUD endpoints below (GET/POST/PATCH/DELETE /scheduled-reports).
- apps/worker's Celery beat task is the only caller of the /internal/*
  endpoints -- it has no human session, so those authenticate via a shared
  secret (require_internal_secret) instead of a user JWT, and explicitly
  loop over every Tenant + SET LOCAL app.tenant_id per tenant to read
  across tenant boundaries, rather than bypassing RLS. See
  apps/worker/tasks.py for the daily beat tick that calls these.

Only "financial_summary" is schedulable in this first pass (see
REPORT_TYPES on the model) -- other report types can be added the same way
later without a schema change, since report_type is just a string column
with a CHECK constraint.
"""

import html as html_escape
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_internal_secret, require_permission
from app.models import ScheduledReportSetting, Tenant, User
from app.models.scheduled_report_setting import FREQUENCIES, REPORT_TYPES
from app.pdf import html_to_pdf
from app.routers.reports import compute_financial_summary
from app.schemas.scheduled_reports import (
    DueScheduledReportOut,
    ScheduledReportSettingCreateRequest,
    ScheduledReportSettingOut,
    ScheduledReportSettingUpdateRequest,
)

router = APIRouter()

FINANCIAL_SUMMARY_EMAIL_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 2cm; }}
  body {{ font-family: sans-serif; font-size: 12px; color: #111; }}
  h1 {{ font-size: 20px; margin: 0 0 4px 0; }}
  .meta {{ margin-bottom: 24px; color: #444; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; }}
  th {{ background: #f3f3f3; }}
  td.num, th.num {{ text-align: right; }}
  .net {{ margin-top: 12px; font-weight: bold; text-align: right; font-size: 14px; }}
</style>
</head>
<body>
  <h1>Financial Summary</h1>
  <div class="meta">{date_from} to {date_to}</div>
  <table>
    <tbody>
      <tr><td>Revenue</td><td class="num">{revenue}</td></tr>
      <tr><td>Expenses</td><td class="num">-{expenses}</td></tr>
      <tr><td>Purchases</td><td class="num">-{purchases}</td></tr>
    </tbody>
  </table>
  <div class="net">Net: {net}</div>
</body>
</html>"""


def _period_for_frequency(frequency: str, today: date) -> tuple[date, date]:
    if frequency == "weekly":
        date_to = today - timedelta(days=1)
        date_from = date_to - timedelta(days=6)
        return date_from, date_to
    # monthly -- previous full calendar month
    first_of_this_month = today.replace(day=1)
    last_of_prev_month = first_of_this_month - timedelta(days=1)
    return last_of_prev_month.replace(day=1), last_of_prev_month


def _is_due(setting: ScheduledReportSetting, today: date) -> bool:
    if not setting.is_active:
        return False
    if setting.last_sent_at is not None and setting.last_sent_at.date() == today:
        return False
    if setting.frequency == "weekly":
        return today.weekday() == 0  # Monday
    if setting.frequency == "monthly":
        return today.day == 1
    return False


# ---------------------------------------------------------------------------
# Tenant-facing CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/scheduled-reports", response_model=list[ScheduledReportSettingOut], operation_id="listScheduledReports"
)
def list_scheduled_reports(
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("reports.view")),
) -> list[ScheduledReportSetting]:
    return db.query(ScheduledReportSetting).order_by(ScheduledReportSetting.created_at.desc()).all()


@router.post(
    "/scheduled-reports",
    status_code=status.HTTP_201_CREATED,
    response_model=ScheduledReportSettingOut,
    operation_id="createScheduledReport",
)
def create_scheduled_report(
    payload: ScheduledReportSettingCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("reports.export")),
) -> ScheduledReportSetting:
    if payload.report_type not in REPORT_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_report_type")
    if payload.frequency not in FREQUENCIES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_frequency")

    setting = ScheduledReportSetting(
        tenant_id=user.tenant_id,
        branch_id=payload.branch_id,
        report_type=payload.report_type,
        frequency=payload.frequency,
        recipient_email=payload.recipient_email,
    )
    db.add(setting)
    db.flush()  # populate setting.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="scheduled_report_setting",
        entity_id=setting.id,
        new_values={"report_type": payload.report_type, "frequency": payload.frequency},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(setting)
    return setting


@router.patch(
    "/scheduled-reports/{setting_id}", response_model=ScheduledReportSettingOut, operation_id="updateScheduledReport"
)
def update_scheduled_report(
    setting_id: uuid.UUID,
    payload: ScheduledReportSettingUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("reports.export")),
) -> ScheduledReportSetting:
    setting = db.get(ScheduledReportSetting, setting_id)
    if setting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="scheduled_report_setting_not_found")

    updates = payload.model_dump(exclude_none=True)
    if "frequency" in updates and updates["frequency"] not in FREQUENCIES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_frequency")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in updates.items():
        current = getattr(setting, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(setting, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="scheduled_report_setting",
            entity_id=setting.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(setting)
    return setting


@router.delete(
    "/scheduled-reports/{setting_id}", status_code=status.HTTP_204_NO_CONTENT, operation_id="deleteScheduledReport"
)
def delete_scheduled_report(
    setting_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("reports.export")),
) -> None:
    setting = db.get(ScheduledReportSetting, setting_id)
    if setting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="scheduled_report_setting_not_found")

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="delete",
        entity_type="scheduled_report_setting",
        entity_id=setting.id,
        old_values={"report_type": setting.report_type, "frequency": setting.frequency},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.delete(setting)
    db.commit()


# ---------------------------------------------------------------------------
# Internal (worker-only, shared-secret authenticated)
# ---------------------------------------------------------------------------


@router.get(
    "/internal/scheduled-reports/due",
    response_model=list[DueScheduledReportOut],
    operation_id="internalListDueScheduledReports",
)
def internal_list_due_scheduled_reports(
    db: Session = Depends(get_db),
    _secret: None = Depends(require_internal_secret),
) -> list[DueScheduledReportOut]:
    today = date.today()
    due: list[DueScheduledReportOut] = []
    for tenant in db.query(Tenant).all():
        set_tenant_context(db, str(tenant.id))
        settings_rows = db.query(ScheduledReportSetting).filter(ScheduledReportSetting.is_active.is_(True)).all()
        for setting in settings_rows:
            if _is_due(setting, today):
                due.append(
                    DueScheduledReportOut(
                        id=setting.id,
                        tenant_id=tenant.id,
                        report_type=setting.report_type,
                        recipient_email=setting.recipient_email,
                    )
                )
    return due


@router.get("/internal/scheduled-reports/{setting_id}/pdf", operation_id="internalGetScheduledReportPdf")
def internal_get_scheduled_report_pdf(
    setting_id: uuid.UUID,
    tenant_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    _secret: None = Depends(require_internal_secret),
) -> Response:
    set_tenant_context(db, str(tenant_id))
    setting = db.get(ScheduledReportSetting, setting_id)
    if setting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="scheduled_report_setting_not_found")

    date_from, date_to = _period_for_frequency(setting.frequency, date.today())

    if setting.report_type == "financial_summary":
        report = compute_financial_summary(db, date_from, date_to, setting.branch_id)
        html_doc = FINANCIAL_SUMMARY_EMAIL_TEMPLATE.format(
            date_from=date_from,
            date_to=date_to,
            revenue=f"{report.revenue:,.2f}",
            expenses=f"{report.expenses:,.2f}",
            purchases=f"{report.purchases:,.2f}",
            net=f"{report.net:,.2f}",
        )
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="unsupported_report_type")

    pdf_bytes = html_to_pdf(html_doc)
    filename = html_escape.escape(f"{setting.report_type}-{date_from}-to-{date_to}.pdf")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/internal/scheduled-reports/{setting_id}/mark-sent", operation_id="internalMarkScheduledReportSent")
def internal_mark_scheduled_report_sent(
    setting_id: uuid.UUID,
    tenant_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    _secret: None = Depends(require_internal_secret),
) -> dict:
    set_tenant_context(db, str(tenant_id))
    setting = db.get(ScheduledReportSetting, setting_id)
    if setting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="scheduled_report_setting_not_found")

    setting.last_sent_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "ok"}
