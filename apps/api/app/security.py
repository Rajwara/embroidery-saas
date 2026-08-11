"""
Pure security functions: password hashing, JWT, TOTP, reset tokens.
No FastAPI imports here -- app/dependencies.py wires this into the request cycle.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import pyotp
from jose import jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def _create_token(user_id: uuid.UUID, tenant_id: uuid.UUID, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: uuid.UUID, tenant_id: uuid.UUID) -> str:
    return _create_token(
        user_id, tenant_id, "access", timedelta(minutes=settings.access_token_expire_minutes)
    )


def create_refresh_token(user_id: uuid.UUID, tenant_id: uuid.UUID) -> str:
    return _create_token(
        user_id, tenant_id, "refresh", timedelta(days=settings.refresh_token_expire_days)
    )


def decode_token(token: str) -> dict:
    """Raises jose.JWTError on bad signature/expiry -- callers turn that into a 401."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def totp_provisioning_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name="Embroidery SaaS")


def verify_totp_code(secret: str, code: str) -> bool:
    return pyotp.totp.TOTP(secret).verify(code, valid_window=1)


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    # sha256, not bcrypt: these are high-entropy random tokens, not user-chosen
    # passwords, so a fast hash is fine and avoids bcrypt's 72-byte input quirks.
    return hashlib.sha256(token.encode()).hexdigest()
