"""Thin Resend wrapper. No-ops (logs instead of sending) when RESEND_API_KEY is unset."""

import logging

import resend

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Fallback only -- used if a tenant somehow has no Factory row yet (e.g. a
# forgot-password request mid-onboarding). Normal sends read the "From" and
# optional reply-to from Factory.notification_from_name/_email/_reply_to_email
# (Settings > Notifications), not this constant.
DEFAULT_FROM_ADDRESS = "Embroidery SaaS <onboarding@resend.dev>"


def _send(to_email: str, subject: str, html: str, from_name: str | None, from_email: str | None, reply_to: str | None) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY unset; skipping email to %s (%s)", to_email, subject)
        return

    from_address = f"{from_name} <{from_email}>" if from_name and from_email else DEFAULT_FROM_ADDRESS
    payload = {"from": from_address, "to": [to_email], "subject": subject, "html": html}
    if reply_to:
        payload["reply_to"] = reply_to

    resend.api_key = settings.resend_api_key
    resend.Emails.send(payload)


def send_password_reset_email(
    to_email: str,
    reset_url: str,
    from_name: str | None = None,
    from_email: str | None = None,
    reply_to: str | None = None,
) -> None:
    _send(
        to_email,
        "Reset your password",
        f'<p>Click <a href="{reset_url}">here</a> to reset your password. This link expires in 30 minutes.</p>',
        from_name,
        from_email,
        reply_to,
    )


def send_invite_email(
    to_email: str,
    invite_url: str,
    factory_name: str,
    from_name: str | None = None,
    from_email: str | None = None,
    reply_to: str | None = None,
) -> None:
    """Reuses the exact same PasswordResetToken mechanism as
    send_password_reset_email (see routers/users.py::invite_user) -- an
    invite is, functionally, a forced password reset for a brand-new
    account. Only the copy differs."""
    _send(
        to_email,
        f"You've been invited to {factory_name}",
        (
            f"<p>You've been invited to join {factory_name} on Embroidery SaaS. "
            f'Click <a href="{invite_url}">here</a> to set your password and log in. '
            "This link expires in 30 minutes.</p>"
        ),
        from_name,
        from_email,
        reply_to,
    )
