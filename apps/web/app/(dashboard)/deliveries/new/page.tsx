"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createDeliveryChallan, getDeliveryReconciliation, listBranches, listParties } from "@embroidery/types";
import type { BranchOut, DeliveryChallanLineCreateRequest, Party, ReconciliationRow } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const UNIT_LABELS: Record<string, string> = {
  shirt: "Shirt",
  dupatta: "Dupatta",
  trouser: "Trouser",
};

export default function NewDeliveryChallanPage() {
  const router = useRouter();

  const [parties, setParties] = useState<Party[]>([]);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [partyId, setPartyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const [reconciliation, setReconciliation] = useState<ReconciliationRow[] | null>(null);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listParties(), listBranches()])
      .then(([partiesData, branchesData]) => {
        setParties(partiesData);
        setBranches(branchesData);
      })
      .catch(() => setLoadError("Could not load parties/branches."));
  }, []);

  const loadReconciliation = useCallback((selectedPartyId: string) => {
    setReconciliationError(null);
    setReconciliation(null);
    setQuantities({});
    if (!selectedPartyId) return;
    getDeliveryReconciliation({ party_id: selectedPartyId })
      .then(setReconciliation)
      .catch(() => setReconciliationError("Could not load available quantities for this party."));
  }, []);

  const handlePartyChange = (value: string) => {
    setPartyId(value);
    loadReconciliation(value);
  };

  const rowKey = (row: ReconciliationRow) => `${row.lot_colour_id}:${row.unit_type}`;

  const deliverableRows = (reconciliation ?? []).filter((row) => row.remaining > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const lines = deliverableRows
      .map((row) => {
        const raw = quantities[rowKey(row)];
        const quantity = Number(raw);
        return raw && quantity > 0
          ? {
              lot_colour_id: row.lot_colour_id,
              unit_type: row.unit_type as DeliveryChallanLineCreateRequest["unit_type"],
              quantity,
            }
          : null;
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    if (lines.length === 0) {
      setSubmitError("Enter a quantity for at least one line.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createDeliveryChallan({
        branch_id: branchId,
        party_id: partyId,
        delivery_date: deliveryDate,
        notes: notes || undefined,
        lines,
      });
      router.push(`/deliveries/${created.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">New Delivery Challan</h1>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-6 shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Party</label>
            <select
              value={partyId}
              onChange={(e) => handlePartyChange(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a party
              </option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a branch
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Delivery date</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {partyId && (
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold">Available to deliver</h2>
            {reconciliationError && <p className="text-sm text-red-600">{reconciliationError}</p>}
            {!reconciliationError && reconciliation === null && (
              <p className="text-sm text-gray-500">Loading available quantities...</p>
            )}
            {!reconciliationError && reconciliation !== null && deliverableRows.length === 0 && (
              <p className="text-sm text-gray-500">Nothing ready to deliver for this party yet.</p>
            )}
            {!reconciliationError && deliverableRows.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-1 pr-2 font-medium">Lot #</th>
                    <th className="py-1 pr-2 font-medium">Colour</th>
                    <th className="py-1 pr-2 font-medium">Unit</th>
                    <th className="py-1 pr-2 font-medium">Remaining</th>
                    <th className="py-1 font-medium">Deliver</th>
                  </tr>
                </thead>
                <tbody>
                  {deliverableRows.map((row) => (
                    <tr key={rowKey(row)} className="border-b border-gray-100 last:border-0">
                      <td className="py-1 pr-2">{row.lot_number}</td>
                      <td className="py-1 pr-2">{row.colour_name}</td>
                      <td className="py-1 pr-2">{UNIT_LABELS[row.unit_type] ?? row.unit_type}</td>
                      <td className="py-1 pr-2">{row.remaining}</td>
                      <td className="py-1">
                        <input
                          type="number"
                          min={0}
                          max={row.remaining}
                          value={quantities[rowKey(row)] ?? ""}
                          onChange={(e) =>
                            setQuantities((prev) => ({ ...prev, [rowKey(row)]: e.target.value }))
                          }
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="submit"
            disabled={submitting || !partyId || !branchId}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creating..." : "Create challan"}
          </button>
        </div>
      </form>
    </div>
  );
}
