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


def send_invite_email(to_email: str, invite_url: str, factory_name: str) -> None:
    """Reuses the exact same PasswordResetToken mechanism as
    send_password_reset_email (see routers/users.py::invite_user) -- an
    invite is, functionally, a forced password reset for a brand-new
    account. Only the copy differs."""
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY unset; skipping invite email to %s. URL: %s", to_email, invite_url)
        return

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": f"You've been invited to {factory_name}",
            "html": (
                f"<p>You've been invited to join {factory_name} on Embroidery SaaS. "
                f'Click <a href="{invite_url}">here</a> to set your password and log in. '
                "This link expires in 30 minutes.</p>"
            ),
        }
    )
