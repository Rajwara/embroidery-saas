"use client";

import { useCallback, useEffect, useState } from "react";

import { getFactory, updateFactory } from "@embroidery/types";
import type { FactoryOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

export default function NotificationSettingsPage() {
  const [factory, setFactory] = useState<FactoryOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setFactory(null);
    getFactory()
      .then((data) => {
        setFactory(data);
        setFromName(data.notification_from_name);
        setFromEmail(data.notification_from_email);
        setReplyToEmail(data.notification_reply_to_email ?? "");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view notification settings.");
        } else {
          setError("Could not load notification settings.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const updated = await updateFactory({
        notification_from_name: fromName,
        notification_from_email: fromEmail,
        notification_reply_to_email: replyToEmail || null,
      });
      setFactory(updated);
      setSaved(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
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

  if (factory === null) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Notifications</h1>

      <div className="space-y-4 rounded bg-white p-6 shadow">
        <div>
          <h2 className="text-lg font-semibold">Outgoing Email</h2>
          <p className="text-sm text-gray-500">
            Every system email -- password resets, user invites, and scheduled report deliveries -- is sent
            with this name and address.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">From name</label>
            <input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">From email</label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">
              Must be a Resend-verified sending domain, or delivery will fail.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reply-to email (optional)</label>
            <input
              type="email"
              value={replyToEmail}
              onChange={(e) => setReplyToEmail(e.target.value)}
              placeholder="Leave blank to disable replies"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          {saved && !submitError && <p className="text-sm text-green-700">Saved.</p>}

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
