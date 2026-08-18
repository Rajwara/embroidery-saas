"use client";

import { useCallback, useEffect, useState, use } from "react";

import { getLot, listBranches, listParties } from "@embroidery/types";
import type { BranchOut, LotDetailOut, Party } from "@embroidery/types";

import { ApiError } from "@/lib/api";

import { ColourBreakdown } from "../_components/ColourBreakdown";
import { ComponentConfirmation } from "../_components/ComponentConfirmation";
import { StatusBadge } from "../_components/StatusBadge";

const SUIT_TYPE_LABELS: Record<string, string> = {
  one_piece: "One-piece",
  two_piece: "Two-piece",
  three_piece: "Three-piece",
};

const COMPONENT_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  sleeves: "Sleeves",
  trouser: "Trouser",
  dupatta: "Dupatta",
};

export default function LotDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [lot, setLot] = useState<LotDetailOut | null>(null);
  const [partyName, setPartyName] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLot(null);
    Promise.all([getLot(params.id), listParties(), listBranches()])
      .then(([lotData, parties, branches]: [LotDetailOut, Party[], BranchOut[]]) => {
        setLot(lotData);
        setPartyName(parties.find((p) => p.id === lotData.party_id)?.name ?? null);
        setBranchName(branches.find((b) => b.id === lotData.branch_id)?.name ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Lot not found.");
        } else {
          setError("Could not load lot.");
        }
      });
  }, [params.id]);

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

  if (lot === null) {
    return <p className="text-sm text-gray-500">Loading lot...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{lot.lot_number}</h1>
          <p className="text-sm text-gray-500">
            {partyName ?? "—"} · {branchName ?? "—"} · {SUIT_TYPE_LABELS[lot.suit_type] ?? lot.suit_type} ·{" "}
            {lot.total_suit_count} suits · received {lot.received_date}
          </p>
          {lot.notes && <p className="mt-1 text-sm text-gray-500">{lot.notes}</p>}
        </div>
        <StatusBadge status={lot.status} />
      </div>

      {lot.status === "pending_breakdown" && <ColourBreakdown lot={lot} onGenerated={setLot} />}
      {lot.status === "pending_confirmation" && <ComponentConfirmation lot={lot} onConfirmed={setLot} />}
      {lot.status === "confirmed" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Colours &amp; components</h2>
          {lot.colours.map((colour) => (
            <div key={colour.id} className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">
                {colour.colour_name} <span className="text-gray-400">({colour.suit_count} suits)</span>
              </h3>
              <ul className="divide-y divide-gray-100 rounded bg-white shadow">
                {colour.components.map((component) => (
                  <li key={component.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="font-medium">
                      {COMPONENT_LABELS[component.component_type] ?? component.component_type}
                    </span>
                    <span className="text-gray-500">
                      Expected {component.expected_quantity} · Confirmed {component.confirmed_quantity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
