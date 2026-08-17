"use client";

import { useCallback, useEffect, useState } from "react";

import { getSubscription } from "@embroidery/types";
import type { SubscriptionOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  trialing: "bg-blue-50 text-blue-700",
  active: "bg-green-50 text-green-700",
  past_due: "bg-amber-50 text-amber-700",
  canceled: "bg-red-50 text-red-700",
};

function formatPlan(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function SubscriptionSettingsPage() {
  const [subscription, setSubscription] = useState<SubscriptionOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setSubscription(null);
    getSubscription()
      .then(setSubscription)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view subscription details.");
        } else {
          setError("Could not load subscription details.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  if (subscription === null) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  const statusStyle = STATUS_STYLES[subscription.status] ?? "bg-gray-100 text-gray-700";

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Subscription</h1>

      <div className="space-y-4 rounded bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-gray-400">Plan</p>
            <p className="text-lg font-semibold">{formatPlan(subscription.plan)}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle}`}>
            {formatStatus(subscription.status)}
          </span>
        </div>

        {subscription.renews_at && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium uppercase text-gray-400">
              {subscription.status === "trialing" ? "Trial ends" : "Renews"}
            </p>
            <p className="text-sm text-gray-700">{subscription.renews_at}</p>
          </div>
        )}

        <p className="border-t border-gray-100 pt-4 text-sm text-gray-500">
          To change your plan or update billing details, contact your account manager.
        </p>
      </div>
    </div>
  );
}
