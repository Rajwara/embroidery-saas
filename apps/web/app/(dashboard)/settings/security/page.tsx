"use client";

import { useCallback, useEffect, useState } from "react";

import { disableTotp, getMe, setupTotp, verifyTotp } from "@embroidery/types";
import type { UserProfileResponse } from "@embroidery/types";

import { ApiError } from "@/lib/api";

export default function SecuritySettingsPage() {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableSubmitting, setDisableSubmitting] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setProfile(null);
    getMe()
      .then(setProfile)
      .catch(() => setError("Could not load your security settings."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startSetup = async () => {
    setSetupError(null);
    try {
      const result = await setupTotp();
      setSetupSecret(result.secret);
      setSetupUri(result.provisioning_uri);
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.detail : "Could not start 2FA setup.");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupSecret) return;
    setSetupError(null);
    setSetupSubmitting(true);
    try {
      await verifyTotp({ secret: setupSecret, code: verifyCode });
      setSetupSecret(null);
      setSetupUri(null);
      setVerifyCode("");
      load();
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.detail : "Invalid code. Please try again.");
    } finally {
      setSetupSubmitting(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError(null);
    setDisableSubmitting(true);
    try {
      await disableTotp({ password: disablePassword });
      setDisablePassword("");
      setShowDisable(false);
      load();
    } catch (err) {
      setDisableError(err instanceof ApiError ? err.detail : "Could not disable 2FA.");
    } finally {
      setDisableSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>{error}</span>
        <button onClick={load} className="font-medium underline">
          Retry
        </button>
      </div>
    );
  }

  if (profile === null) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Security</h1>

      <div className="space-y-4 rounded bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Two-factor authentication</h2>
            <p className="text-sm text-gray-500">
              {profile.mfa_enabled ? "Enabled for your account." : "Not enabled."}
            </p>
          </div>
          {profile.mfa_enabled ? (
            <button
              onClick={() => setShowDisable((v) => !v)}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
            >
              Disable
            </button>
          ) : (
            !setupSecret && (
              <button
                onClick={startSetup}
                className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
              >
                Enable
              </button>
            )
          )}
        </div>

        {setupSecret && setupUri && (
          <form onSubmit={handleVerify} className="space-y-3 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
              Add this key to your authenticator app (Google Authenticator, Authy, etc.), then enter the
              6-digit code it generates.
            </p>
            <div className="rounded bg-gray-50 p-3 font-mono text-xs break-all">{setupSecret}</div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Verification code</label>
              <input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="123456"
                required
                className="mt-1 w-32 rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {setupError && <p className="text-sm text-red-600">{setupError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSetupSecret(null);
                  setSetupUri(null);
                }}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={setupSubmitting || !verifyCode}
                className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {setupSubmitting ? "Verifying..." : "Verify and enable"}
              </button>
            </div>
          </form>
        )}

        {showDisable && (
          <form onSubmit={handleDisable} className="space-y-3 border-t border-gray-100 pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm your password</label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {disableError && <p className="text-sm text-red-600">{disableError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDisable(false)}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disableSubmitting || !disablePassword}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {disableSubmitting ? "Disabling..." : "Disable 2FA"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
