// Tokens are stored in localStorage: the backend returns them in the JSON
// response body (not Set-Cookie), and an httpOnly-cookie approach would need
// backend changes (cookie-setting, CSRF handling) that are out of scope here.
// Revisit as part of ROADMAP.md Phase 5's "Security hardening pass" if the
// app ever gains third-party script surface (ads, analytics SDKs,
// user-generated HTML rendering) that makes XSS a live concern.

const STORAGE_KEY = "efms_auth";

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
}

export function getTokens(): StoredTokens | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function setTokens(tokens: StoredTokens): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
