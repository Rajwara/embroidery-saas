"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Stage = "credentials" | "mfa";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.detail === "mfa_required") {
        setStage("mfa");
      } else if (err instanceof ApiError && err.detail === "inactive_account") {
        setError("This account has been deactivated. Contact your administrator.");
      } else if (err instanceof ApiError && err.detail === "invalid_credentials") {
        setError("Invalid email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, totpCode);
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.detail === "mfa_invalid") {
        setError("Invalid code. Try again.");
      } else {
        setError("Something went wrong. Please try again.");
        setStage("credentials");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Embroidery Factory Management</h1>

      {stage === "credentials" ? (
        <form
          onSubmit={handleCredentialsSubmit}
          className="w-full max-w-sm space-y-4 rounded bg-white p-6 shadow"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={handleMfaSubmit}
          className="w-full max-w-sm space-y-4 rounded bg-white p-6 shadow"
        >
          <p className="text-sm text-gray-600">Enter the 6-digit code from your authenticator app.</p>
          <div>
            <label className="mb-1 block text-sm font-medium">Authentication code</label>
            <input
              type="text"
              inputMode="numeric"
              required
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Verifying..." : "Verify"}
          </button>
        </form>
      )}
    </main>
  );
}
