"use client";

import { useState } from "react";

import { createTrialAccount } from "@embroidery/types";
import type { TrialAccountOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

export default function TrialAccountsPage() {
  const [factoryName, setFactoryName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFullName, setAdminFullName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<TrialAccountOut | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setSubmitting(true);
    try {
      const result = await createTrialAccount({
        factory_name: factoryName,
        admin_email: adminEmail,
        admin_full_name: adminFullName,
      });
      setCreated(result);
      setFactoryName("");
      setAdminEmail("");
      setAdminFullName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not create the trial account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Trial Accounts</h1>
      <p className="text-sm text-gray-500">
        Provisions a new tenant and its owner account. The owner gets an invite email with a
        set-your-password link and lands in onboarding to create their Company Profile on first login.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-6 shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700">Factory name</label>
          <input
            value={factoryName}
            onChange={(e) => setFactoryName(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Owner full name</label>
          <input
            value={adminFullName}
            onChange={(e) => setAdminFullName(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Owner email</label>
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {created && (
          <p className="text-sm text-green-700">
            Created &quot;{created.tenant_name}&quot; -- invite sent to {created.admin_email}.
          </p>
        )}

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="submit"
            disabled={submitting || !factoryName || !adminEmail || !adminFullName}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creating..." : "Create trial account"}
          </button>
        </div>
      </form>
    </div>
  );
}
