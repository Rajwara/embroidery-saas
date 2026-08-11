"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { listBranches, listLots, listParties } from "@embroidery/types";
import type { BranchOut, LotOut, Party } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

import { StatusBadge } from "./_components/StatusBadge";

const SUIT_TYPE_LABELS: Record<string, string> = {
  one_piece: "One-piece",
  two_piece: "Two-piece",
  three_piece: "Three-piece",
};

export default function LotsPage() {
  const { hasPermission } = useAuth();
  const [lots, setLots] = useState<LotOut[] | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLots(null);
    Promise.all([listLots(), listParties(), listBranches()])
      .then(([lotsData, partiesData, branchesData]) => {
        setLots(lotsData);
        setParties(partiesData);
        setBranches(branchesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view lots.");
        } else {
          setError("Could not load lots.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? "—";
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lots</h1>
        {hasPermission("lots.create") && (
          <Link
            href="/lots/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            New Lot
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

      {!error && lots === null && <p className="text-sm text-gray-500">Loading lots...</p>}

      {!error && lots !== null && lots.length === 0 && (
        <p className="text-sm text-gray-500">No lots found.</p>
      )}

      {!error && lots !== null && lots.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Lot #</th>
              <th className="px-4 py-2 font-medium">Party</th>
              <th className="px-4 py-2 font-medium">Branch</th>
              <th className="px-4 py-2 font-medium">Suit type</th>
              <th className="px-4 py-2 font-medium">Suits</th>
              <th className="px-4 py-2 font-medium">Received</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/lots/${lot.id}`} className="font-medium text-gray-900 underline">
                    {lot.lot_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{partyName(lot.party_id)}</td>
                <td className="px-4 py-2">{branchName(lot.branch_id)}</td>
                <td className="px-4 py-2">{SUIT_TYPE_LABELS[lot.suit_type] ?? lot.suit_type}</td>
                <td className="px-4 py-2">{lot.total_suit_count}</td>
                <td className="px-4 py-2">{lot.received_date}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={lot.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
