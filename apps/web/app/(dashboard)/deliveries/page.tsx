"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { listDeliveryChallans, listParties } from "@embroidery/types";
import type { DeliveryChallanOut, Party } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function DeliveryChallansPage() {
  const { hasPermission } = useAuth();
  const [challans, setChallans] = useState<DeliveryChallanOut[] | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setChallans(null);
    Promise.all([listDeliveryChallans(), listParties()])
      .then(([challansData, partiesData]) => {
        setChallans(challansData);
        setParties(partiesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view delivery challans.");
        } else {
          setError("Could not load delivery challans.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Delivery Challans</h1>
        {hasPermission("delivery_challans.create") && (
          <Link
            href="/deliveries/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            New Challan
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

      {!error && challans === null && <p className="text-sm text-gray-500">Loading challans...</p>}

      {!error && challans !== null && challans.length === 0 && (
        <p className="text-sm text-gray-500">No delivery challans found.</p>
      )}

      {!error && challans !== null && challans.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Challan #</th>
              <th className="px-4 py-2 font-medium">Party</th>
              <th className="px-4 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {challans.map((challan) => (
              <tr key={challan.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/deliveries/${challan.id}`} className="font-medium text-gray-900 underline">
                    {challan.challan_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{partyName(challan.party_id)}</td>
                <td className="px-4 py-2">{challan.delivery_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
