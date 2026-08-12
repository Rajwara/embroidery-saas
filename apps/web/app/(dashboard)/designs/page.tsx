"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { listDesigns } from "@embroidery/types";
import type { DesignOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function DesignsPage() {
  const { hasPermission } = useAuth();
  const [designs, setDesigns] = useState<DesignOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setDesigns(null);
    listDesigns()
      .then(setDesigns)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view designs.");
        } else {
          setError("Could not load designs.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Designs</h1>
        {hasPermission("designs.create") && (
          <Link
            href="/designs/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            New Design
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && designs === null && <p className="text-sm text-gray-500">Loading designs...</p>}

      {!error && designs !== null && designs.length === 0 && (
        <p className="text-sm text-gray-500">No designs found.</p>
      )}

      {!error && designs !== null && designs.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Master #</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {designs.map((design) => (
              <tr key={design.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/designs/${design.id}`} className="font-medium text-gray-900 underline">
                    {design.master_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{design.name}</td>
                <td className="px-4 py-2">{design.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
