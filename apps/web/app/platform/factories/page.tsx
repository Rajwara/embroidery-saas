"use client";

import { useCallback, useEffect, useState } from "react";

import { listSubscriberFactories, updateSubscriberFactory } from "@embroidery/types";
import type { SubscriberFactoryOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const PLAN_OPTIONS = ["trial", "starter", "pro", "enterprise"];
const STATUS_OPTIONS = ["trialing", "active", "past_due", "canceled"];

export default function SubscriberFactoriesPage() {
  const [factories, setFactories] = useState<SubscriberFactoryOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setFactories(null);
    listSubscriberFactories()
      .then(setFactories)
      .catch((err) => {
        setError(err instanceof ApiError ? err.detail : "Could not load subscriber factories.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = async (
    tenantId: string,
    patch: { subscription_plan?: string; subscription_status?: string; is_active?: boolean }
  ) => {
    setRowError(null);
    setSavingId(tenantId);
    try {
      const updated = await updateSubscriberFactory(tenantId, patch);
      setFactories((prev) => (prev ? prev.map((f) => (f.id === tenantId ? updated : f)) : prev));
    } catch (err) {
      setRowError(err instanceof ApiError ? err.detail : "Could not update this factory.");
    } finally {
      setSavingId(null);
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

  if (factories === null) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Subscriber Factories</h1>
      <p className="text-sm text-gray-500">
        Account and subscription metadata only -- this list intentionally never shows a factory&apos;s
        business data (parties, invoices, production, etc.).
      </p>

      {rowError && <p className="text-sm text-red-600">{rowError}</p>}

      <table className="w-full rounded bg-white text-sm shadow">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Plan</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Renews</th>
            <th className="px-4 py-2 font-medium">Users</th>
            <th className="px-4 py-2 font-medium">Active</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {factories.map((f) => (
            <tr key={f.id} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2">{f.name}</td>
              <td className="px-4 py-2">
                {editingId === f.id ? (
                  <select
                    value={f.subscription_plan}
                    disabled={savingId === f.id}
                    onChange={(e) => handleUpdate(f.id, { subscription_plan: e.target.value })}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    {PLAN_OPTIONS.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan}
                      </option>
                    ))}
                  </select>
                ) : (
                  f.subscription_plan
                )}
              </td>
              <td className="px-4 py-2">
                {editingId === f.id ? (
                  <select
                    value={f.subscription_status}
                    disabled={savingId === f.id}
                    onChange={(e) => handleUpdate(f.id, { subscription_status: e.target.value })}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  f.subscription_status
                )}
              </td>
              <td className="px-4 py-2">{f.subscription_renews_at ?? "—"}</td>
              <td className="px-4 py-2">{f.user_count}</td>
              <td className="px-4 py-2">{f.is_active ? "Yes" : "No"}</td>
              <td className="px-4 py-2 text-right">
                {editingId === f.id ? (
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs font-medium text-gray-700 underline"
                  >
                    Done
                  </button>
                ) : (
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setEditingId(f.id)}
                      className="text-xs font-medium text-gray-700 underline"
                    >
                      Edit
                    </button>
                    <button
                      disabled={savingId === f.id}
                      onClick={() => handleUpdate(f.id, { is_active: !f.is_active })}
                      className="text-xs font-medium text-gray-700 underline disabled:opacity-40"
                    >
                      {f.is_active ? "Suspend" : "Reactivate"}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {factories.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                No factories yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
