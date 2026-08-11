"use client";

import { useCallback, useEffect, useState } from "react";

import { listParties } from "@embroidery/types";
import type { Party } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function PartiesPage() {
  const { hasPermission } = useAuth();
  const [parties, setParties] = useState<Party[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSeeMoney = hasPermission("parties.see_money");

  const load = useCallback(() => {
    setError(null);
    setParties(null);
    listParties()
      .then(setParties)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view parties.");
        } else {
          setError("Could not load parties.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Parties</h1>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && parties === null && <p className="text-sm text-gray-500">Loading parties...</p>}

      {!error && parties !== null && parties.length === 0 && (
        <p className="text-sm text-gray-500">No parties found.</p>
      )}

      {!error && parties !== null && parties.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              {canSeeMoney && <th className="px-4 py-2 font-medium">Balance</th>}
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {parties.map((party) => (
              <tr key={party.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">{party.name}</td>
                <td className="px-4 py-2">{party.contact_person ?? "—"}</td>
                <td className="px-4 py-2">{party.phone ?? "—"}</td>
                {canSeeMoney && <td className="px-4 py-2">{party.opening_balance ?? "—"}</td>}
                <td className="px-4 py-2">{party.is_active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
