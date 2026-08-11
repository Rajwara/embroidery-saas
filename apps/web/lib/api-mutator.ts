import { apiFetch } from "./api";

// Contract required by orval's `client: "fetch"` custom mutator: receives
// the already-built `url` (path + querystring, e.g. "/parties?skip=0") and
// a RequestInit `options` (method/body/headers already assembled by
// generated code), and must return Promise<T> with the parsed JSON body --
// exactly apiFetch's existing signature and behavior. Pure delegation, no
// logic of its own: apiFetch's 401-refresh-retry, Bearer header injection,
// and API_URL prefixing (lib/api.ts, lib/auth-storage.ts) are reused
// unmodified.
export function apiMutator<T>(url: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(url, options);
}
