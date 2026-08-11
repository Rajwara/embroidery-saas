"""Thin Resend wrapper. No-ops (logs instead of sending) when RESEND_API_KEY is unset."""

import logging

import resend

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

FROM_ADDRESS = "Embroidery SaaS <onboarding@resend.dev>"


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY unset; skipping password reset email to %s. URL: %s", to_email, reset_url)
        return

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": "Reset your password",
            "html": f'<p>Click <a href="{reset_url}">here</a> to reset your password. This link expires in 30 minutes.</p>',
        }
    )
