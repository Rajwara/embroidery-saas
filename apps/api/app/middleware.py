"""
Request body size cap. No endpoint in this API accepts file uploads (see
project memory: greenfield, nothing to validate there) -- every request
body is JSON, and the largest legitimate ones are things like invoice/
purchase line-item arrays, still tiny compared to this limit. This exists
purely as defense-in-depth against trivially large bodies, not because any
real workflow needs bodies anywhere close to this size.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

MAX_BODY_BYTES = 2 * 1024 * 1024  # 2 MB


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length is not None and int(content_length) > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"detail": "request_body_too_large"})
        return await call_next(request)
