"""
Fixed-window rate limiting backed by Redis, applied only to the
brute-force-sensitive pre-authentication endpoints (login, forgot-password,
2FA verify) -- every other endpoint already requires a valid JWT, which is
a far stronger throttle than IP-based counting could ever be.

Fails OPEN, not closed: if Redis is unreachable, the request is allowed
through and a warning is logged, rather than making login itself depend on
Redis being up. Redis was previously only a Celery broker dependency for
apps/worker -- the API itself had no hard runtime dependency on it before
this, and a security hardening feature should not become a new
availability liability.
"""

import logging

import redis
from fastapi import HTTPException, Request, status

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_redis_client: redis.Redis | None = None


def _get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=1)
    return _redis_client


def rate_limit(key_prefix: str, max_requests: int, window_seconds: int):
    """FastAPI dependency factory, e.g.
    Depends(rate_limit("login", max_requests=10, window_seconds=60)).
    Keys on client IP -- these endpoints are hit pre-authentication, so
    there is no user identity yet to key on instead."""

    def dependency(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        key = f"ratelimit:{key_prefix}:{ip}"
        try:
            client = _get_redis()
            count = client.incr(key)
            if count == 1:
                client.expire(key, window_seconds)
        except redis.RedisError:
            logger.warning("Rate limiter: Redis unavailable, allowing request through (key=%s)", key)
            return

        if count > max_requests:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="rate_limit_exceeded")

    return dependency
