import os

from celery import Celery
from celery.schedules import crontab

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("embroidery_saas_worker", broker=redis_url, backend=redis_url)

celery_app.conf.beat_schedule = {
    # Runs every day, not just Monday/the 1st -- tasks.send_scheduled_reports
    # itself asks the API which settings are actually due today (a setting's
    # own frequency determines that), so a single daily tick covers both
    # weekly and monthly schedules without two separate crontab entries.
    "send-scheduled-reports": {
        "task": "tasks.send_scheduled_reports",
        "schedule": crontab(hour=8, minute=0),
    },
    # Catches items that are below minimum_threshold without having had a
    # recent stock-changing event -- the reactive check in
    # maybe_open_purchase_required only fires inside create_stock_transaction
    # and create_purchase, so seeded/imported/directly-edited data can sit
    # below threshold indefinitely with no reorder request ever opened.
    "check-reorder-thresholds": {
        "task": "tasks.check_reorder_thresholds",
        "schedule": crontab(minute=0),
    },
}
