"use client";

import { useCallback, useEffect, useState } from "react";

import { getDeliveryChallan, listParties } from "@embroidery/types";
import type { DeliveryChallanDetailOut, Party } from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";

const UNIT_LABELS: Record<string, string> = {
  shirt: "Shirt",
  dupatta: "Dupatta",
  trouser: "Trouser",
};

export default function DeliveryChallanDetailPage({ params }: { params: { id: string } }) {
  const [challan, setChallan] = useState<DeliveryChallanDetailOut | null>(null);
  const [partyName, setPartyName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setChallan(null);
    Promise.all([getDeliveryChallan(params.id), listParties()])
      .then(([challanData, parties]) => {
        setChallan(challanData);
        setPartyName(parties.find((p) => p.id === challanData.party_id)?.name ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Delivery challan not found.");
        } else {
          setError("Could not load delivery challan.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = async () => {
    if (!challan) return;
    setPrintError(null);
    setPrinting(true);
    try {
      const blob = await fetchPdfBlob(`/delivery-challans/${challan.id}/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setPrintError("Could not generate the PDF. Please try again.");
    } finally {
      setPrinting(false);
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

  if (challan === null) {
    return <p className="text-sm text-gray-500">Loading challan...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{challan.challan_number}</h1>
          <p className="text-sm text-gray-500">
            {partyName ?? "—"} &middot; delivered {challan.delivery_date}
          </p>
          {challan.notes && <p className="mt-1 text-sm text-gray-500">{challan.notes}</p>}
        </div>
        <div className="text-right">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {printing ? "Generating..." : "Print"}
          </button>
          {printError && <p className="mt-1 text-xs text-red-600">{printError}</p>}
        </div>
      </div>

      <table className="w-full rounded bg-white text-sm shadow">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Lot #</th>
            <th className="px-4 py-2 font-medium">Colour</th>
            <th className="px-4 py-2 font-medium">Unit</th>
            <th className="px-4 py-2 font-medium">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {challan.lines.map((line) => (
            <tr key={line.id} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2">{line.lot_number}</td>
              <td className="px-4 py-2">{line.colour_name}</td>
              <td className="px-4 py-2">{UNIT_LABELS[line.unit_type] ?? line.unit_type}</td>
              <td className="px-4 py-2">{line.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
