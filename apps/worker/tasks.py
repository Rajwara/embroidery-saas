from celery_app import celery_app


@celery_app.task
def ping() -> str:
    """Sanity-check task: run `celery -A celery_app call tasks.ping` after
    starting the worker to confirm broker connectivity."""
    return "pong"


# TODO Phase 5: send_weekly_reports, send_monthly_reports, check_low_stock_thresholds
