import os

from celery import Celery
from celery.schedules import crontab

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("embroidery_saas_worker", broker=redis_url, backend=redis_url)

celery_app.conf.beat_schedule = {
    # Phase 5: wire this up to the real weekly-report task once it exists.
    # "send-weekly-reports": {
    #     "task": "worker.tasks.send_weekly_reports",
    #     "schedule": crontab(day_of_week="monday", hour=8, minute=0),
    # },
}
