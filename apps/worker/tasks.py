import logging
import os

import httpx
import resend

from celery_app import celery_app

logger = logging.getLogger(__name__)

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "change-me-in-every-environment")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

# Fallback only -- each due setting carries its own tenant's Factory
# notification config (Settings > Notifications); see _send_report_email.
DEFAULT_FROM_ADDRESS = "Embroidery SaaS <onboarding@resend.dev>"

REPORT_TITLES = {
    "financial_summary": "Financial Summary",
}


@celery_app.task
def ping() -> str:
    """Sanity-check task: run `celery -A celery_app call tasks.ping` after
    starting the worker to confirm broker connectivity."""
    return "pong"


@celery_app.task
def send_scheduled_reports() -> dict:
    """Daily beat tick (see celery_app.py's beat_schedule). The worker has
    no database access of its own (see apps/worker/pyproject.toml -- no
    SQLAlchemy/psycopg dependency, by design) -- it calls back into apps/api
    over HTTP instead, authenticated by a shared secret rather than a user
    JWT, since a scheduled job has no human session. This keeps the worker
    thin and reuses the API's existing tenant-RLS-safe report queries and
    WeasyPrint setup rather than duplicating them here.

    Each due setting is independent: one failure (a bad recipient address, a
    transient API error) is logged and skipped, not allowed to abort the
    whole run.
    """
    headers = {"X-Internal-Secret": INTERNAL_API_SECRET}
    sent_count = 0
    failed_count = 0

    with httpx.Client(base_url=API_BASE_URL, headers=headers, timeout=60.0) as client:
        due_response = client.get("/internal/scheduled-reports/due")
        due_response.raise_for_status()
        due_settings = due_response.json()

        for setting in due_settings:
            setting_id = setting["id"]
            tenant_id = setting["tenant_id"]
            report_type = setting["report_type"]
            recipient_email = setting["recipient_email"]

            try:
                pdf_response = client.get(
                    f"/internal/scheduled-reports/{setting_id}/pdf", params={"tenant_id": tenant_id}
                )
                pdf_response.raise_for_status()
                pdf_bytes = pdf_response.content

                _send_report_email(
                    recipient_email,
                    report_type,
                    pdf_bytes,
                    from_name=setting["from_name"],
                    from_email=setting["from_email"],
                    reply_to_email=setting["reply_to_email"],
                )

                mark_sent_response = client.post(
                    f"/internal/scheduled-reports/{setting_id}/mark-sent", params={"tenant_id": tenant_id}
                )
                mark_sent_response.raise_for_status()
                sent_count += 1
            except Exception:
                logger.exception(
                    "Failed to send scheduled report %s (tenant %s, type %s)", setting_id, tenant_id, report_type
                )
                failed_count += 1

    return {"sent": sent_count, "failed": failed_count}


@celery_app.task
def check_reorder_thresholds() -> dict:
    """Hourly beat tick (see celery_app.py's beat_schedule). Same
    no-database-access-of-its-own shape as send_scheduled_reports -- calls
    back into apps/api's internal endpoint over HTTP, shared-secret
    authenticated, rather than querying Postgres directly."""
    headers = {"X-Internal-Secret": INTERNAL_API_SECRET}
    with httpx.Client(base_url=API_BASE_URL, headers=headers, timeout=60.0) as client:
        response = client.post("/purchase-required/internal/reorder-check")
        response.raise_for_status()
        return response.json()


def _send_report_email(
    to_email: str,
    report_type: str,
    pdf_bytes: bytes,
    from_name: str | None = None,
    from_email: str | None = None,
    reply_to_email: str | None = None,
) -> None:
    title = REPORT_TITLES.get(report_type, report_type)

    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY unset; skipping scheduled report email to %s (%s)", to_email, title)
        return

    from_address = f"{from_name} <{from_email}>" if from_name and from_email else DEFAULT_FROM_ADDRESS
    payload = {
        "from": from_address,
        "to": [to_email],
        "subject": f"Your scheduled report: {title}",
        "html": f"<p>Your {title} report is attached.</p>",
        "attachments": [
            {
                "filename": f"{report_type}.pdf",
                "content": list(pdf_bytes),
            }
        ],
    }
    if reply_to_email:
        payload["reply_to"] = reply_to_email

    resend.api_key = RESEND_API_KEY
    resend.Emails.send(payload)
