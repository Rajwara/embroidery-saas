import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.db import get_db, set_tenant_context
from app.dependencies import get_current_super_admin, get_current_user
from app.email import send_password_reset_email
from app.models import LoginHistory, PasswordResetToken, User
from app.schemas.auth import (
    AccessTokenResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
    TotpDisableRequest,
    TotpSetupResponse,
    TotpVerifyRequest,
    UserProfileResponse,
)
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_reset_token,
    generate_totp_secret,
    hash_password,
    hash_reset_token,
    totp_provisioning_uri,
    verify_password,
    verify_totp_code,
)

router = APIRouter()

RESET_TOKEN_TTL = timedelta(minutes=30)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return ip, user_agent


def _record_login_attempt(
    db: Session,
    *,
    email: str,
    success: bool,
    tenant_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    failure_reason: str | None = None,
    mfa_used: bool = False,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    db.add(
        LoginHistory(
            tenant_id=tenant_id,
            user_id=user_id,
            email_attempted=email,
            success=success,
            failure_reason=failure_reason,
            mfa_used=mfa_used,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
    db.commit()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    ip_address, user_agent = _client_meta(request)

    user = db.query(User).filter(User.email == payload.email).first()
    if user is None:
        _record_login_attempt(
            db, email=payload.email, success=False, failure_reason="user_not_found",
            ip_address=ip_address, user_agent=user_agent,
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")

    if not verify_password(payload.password, user.hashed_password):
        _record_login_attempt(
            db, email=payload.email, success=False, tenant_id=user.tenant_id, user_id=user.id,
            failure_reason="bad_password", ip_address=ip_address, user_agent=user_agent,
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")

    if not user.is_active:
        _record_login_attempt(
            db, email=payload.email, success=False, tenant_id=user.tenant_id, user_id=user.id,
            failure_reason="inactive_account", ip_address=ip_address, user_agent=user_agent,
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="inactive_account")

    mfa_used = False
    if user.is_super_admin and user.mfa_secret:
        if not payload.totp_code:
            _record_login_attempt(
                db, email=payload.email, success=False, tenant_id=user.tenant_id, user_id=user.id,
                failure_reason="mfa_required", ip_address=ip_address, user_agent=user_agent,
            )
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="mfa_required")
        if not verify_totp_code(user.mfa_secret, payload.totp_code):
            _record_login_attempt(
                db, email=payload.email, success=False, tenant_id=user.tenant_id, user_id=user.id,
                failure_reason="mfa_invalid", ip_address=ip_address, user_agent=user_agent,
            )
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="mfa_invalid")
        mfa_used = True

    # Captured before the commit below: db.commit() expires ORM attributes by
    # default, and re-reading them afterward would issue a fresh query in a
    # session whose app.tenant_id GUC is now in its post-commit reverted state.
    user_id, tenant_id = user.id, user.tenant_id

    set_tenant_context(db, str(tenant_id))
    _record_login_attempt(
        db, email=payload.email, success=True, tenant_id=tenant_id, user_id=user_id,
        mfa_used=mfa_used, ip_address=ip_address, user_agent=user_agent,
    )

    return TokenResponse(
        access_token=create_access_token(user_id, tenant_id),
        refresh_token=create_refresh_token(user_id, tenant_id),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> AccessTokenResponse:
    try:
        token_payload = decode_token(payload.refresh_token)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    if token_payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    set_tenant_context(db, token_payload["tenant_id"])
    user = db.get(User, uuid.UUID(token_payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    return AccessTokenResponse(access_token=create_access_token(user.id, user.tenant_id))


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> dict:
    # Always return 200 regardless of whether the email exists -- no user enumeration.
    user = db.query(User).filter(User.email == payload.email).first()
    if user is not None:
        set_tenant_context(db, str(user.tenant_id))
        raw_token = generate_reset_token()
        user_email = user.email  # captured before commit expires the ORM object
        db.add(
            PasswordResetToken(
                tenant_id=user.tenant_id,
                user_id=user.id,
                token_hash=hash_reset_token(raw_token),
                expires_at=datetime.now(timezone.utc) + RESET_TOKEN_TTL,
            )
        )
        db.commit()
        reset_url = f"/reset-password?token={raw_token}"
        send_password_reset_email(user_email, reset_url)

    return {"detail": "if_account_exists_email_sent"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    token_hash = hash_reset_token(payload.token)
    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()

    if (
        reset_token is None
        or reset_token.used_at is not None
        or reset_token.expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_or_expired_token")

    set_tenant_context(db, str(reset_token.tenant_id))
    user = db.get(User, reset_token.user_id)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_or_expired_token")

    user.hashed_password = hash_password(payload.new_password)
    reset_token.used_at = datetime.now(timezone.utc)
    db.commit()

    return {"detail": "password_reset"}


@router.post("/2fa/setup", response_model=TotpSetupResponse)
def setup_totp(user: User = Depends(get_current_super_admin)) -> TotpSetupResponse:
    # Not persisted here -- avoids a half-configured MFA state if the user never confirms.
    secret = generate_totp_secret()
    return TotpSetupResponse(secret=secret, provisioning_uri=totp_provisioning_uri(secret, user.email))


@router.post("/2fa/verify", status_code=status.HTTP_200_OK)
def verify_totp(
    payload: TotpVerifyRequest,
    user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> dict:
    if not verify_totp_code(payload.secret, payload.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_code")

    user.mfa_secret = payload.secret
    db.commit()

    return {"detail": "mfa_enabled"}


@router.post("/2fa/disable", status_code=status.HTTP_200_OK)
def disable_totp(
    payload: TotpDisableRequest,
    user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> dict:
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")

    user.mfa_secret = None
    db.commit()

    return {"detail": "mfa_disabled"}


@router.get("/me", response_model=UserProfileResponse)
def me(user: User = Depends(get_current_user)) -> UserProfileResponse:
    return UserProfileResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        full_name=user.full_name,
        is_super_admin=user.is_super_admin,
        is_platform_admin=user.is_platform_admin,
        mfa_enabled=user.mfa_secret is not None,
    )
