"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { resetPassword } from "@embroidery/types";

import { ApiError } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({ token, new_password: newPassword });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.detail === "invalid_or_expired_token") {
        setError("This link is invalid or has expired. Ask for a new one.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        <p className="text-sm text-red-600">This link is missing its token.</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-2xl font-semibold">Password set</h1>
        <p className="text-sm text-gray-600">You can now sign in with your new password.</p>
        <button
          onClick={() => router.replace("/login")}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Go to login
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Set your password</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded bg-white p-6 shadow">
        <div>
          <label className="mb-1 block text-sm font-medium">New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Confirm password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Set password"}
        </button>
      </form>
    </main>
  );
}
