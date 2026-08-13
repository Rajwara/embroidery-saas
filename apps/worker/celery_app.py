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
}
