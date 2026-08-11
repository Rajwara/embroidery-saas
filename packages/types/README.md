# @embroidery/types

Generated (not hand-written) from the FastAPI OpenAPI spec via [orval](https://orval.dev).

## Regenerating

With the local API running (`cd apps/api && uv run uvicorn app.main:app --reload --port 8000`):

```bash
pnpm --filter @embroidery/types generate
```

This overwrites `generated.ts` from `http://localhost:8000/openapi.json`. Commit the diff.

This is a manual, dev-time step -- it is never run automatically during `pnpm build` or in
CI/Vercel/Railway, since builds must not depend on a live backend being reachable. Run it after
changing any FastAPI route, request/response schema, or `operation_id`.
