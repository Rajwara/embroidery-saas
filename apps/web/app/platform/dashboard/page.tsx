"use client";

import { useCallback, useEffect, useState } from "react";

import { getPlatformDashboard } from "@embroidery/types";
import type { PlatformDashboardOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).replace(/_/g, " ");
}

export default function PlatformDashboardPage() {
  const [data, setData] = useState<PlatformDashboardOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    getPlatformDashboard()
      .then(setData)
      .catch((err) => {
        setError(err instanceof ApiError ? err.detail : "Could not load the platform dashboard.");
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

  if (data === null) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Platform Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded bg-white p-6 shadow">
          <p className="text-xs font-medium uppercase text-gray-400">Total Factories</p>
          <p className="mt-1 text-3xl font-semibold">{data.total_factories}</p>
        </div>
        <div className="rounded bg-white p-6 shadow">
          <p className="text-xs font-medium uppercase text-gray-400">Active Factories</p>
          <p className="mt-1 text-3xl font-semibold">{data.active_factories}</p>
        </div>
        <div className="rounded bg-white p-6 shadow">
          <p className="text-xs font-medium uppercase text-gray-400">Total Users</p>
          <p className="mt-1 text-3xl font-semibold">{data.total_users}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded bg-white p-6 shadow">
          <h2 className="mb-3 text-sm font-semibold">By Plan</h2>
          <div className="space-y-2">
            {Object.entries(data.plan_breakdown).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{capitalize(plan)}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded bg-white p-6 shadow">
          <h2 className="mb-3 text-sm font-semibold">By Status</h2>
          <div className="space-y-2">
            {Object.entries(data.status_breakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{capitalize(status)}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
