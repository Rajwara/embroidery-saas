import { clearTokens, getTokens, setTokens } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

// Module-level singleton so concurrent 401s from parallel requests (e.g.
// /auth/me + /me/permissions firing together) share one refresh call
// instead of racing multiple refreshes.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const tokens = getTokens();
    if (!tokens?.refresh_token) throw new ApiError(401, "invalid_token");

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    });

    if (!res.ok) {
      clearTokens();
      throw new ApiError(res.status, "invalid_token");
    }

    const { access_token } = await res.json();
    // refresh_token is unchanged -- /auth/refresh does not rotate it.
    setTokens({ access_token, refresh_token: tokens.refresh_token });
    return access_token as string;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  _retried = false
): Promise<T> {
  const tokens = getTokens();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (tokens?.access_token) {
    headers.set("Authorization", `Bearer ${tokens.access_token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !_retried && tokens?.refresh_token) {
    try {
      await refreshAccessToken();
    } catch {
      clearTokens();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new ApiError(401, "session_expired");
    }
    return apiFetch<T>(path, init, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? "unknown_error");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
