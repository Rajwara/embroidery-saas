import { defineConfig } from "orval";

// Input is the LIVE local backend, matching this package's original Phase 0
// placeholder comment. Safe because generation is a manual dev-time step
// (see package.json's "generate" script / README.md) -- CI/Vercel/Railway
// builds only ever consume the already-committed ./generated.ts, never run
// orval themselves, so a live backend is never required at build time.
export default defineConfig({
  api: {
    input: "http://localhost:8000/openapi.json",
    output: {
      target: "./generated.ts",
      client: "fetch",
      mode: "single",
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          // Delegates actual HTTP execution to apps/web's existing apiFetch
          // (Bearer header injection + single-flight 401-refresh-retry) --
          // see apps/web/lib/api-mutator.ts. Keeps this package usable only
          // from apps/web today (see that file's docstring for the tradeoff).
          path: "../../apps/web/lib/api-mutator.ts",
          name: "apiMutator",
        },
      },
    },
  },
});
