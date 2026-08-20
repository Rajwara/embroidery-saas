"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createLot, listBranches, listParties } from "@embroidery/types";
import type { BranchOut, LotCreateRequest, Party } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const SUIT_TYPE_OPTIONS: { value: LotCreateRequest["suit_type"]; label: string }[] = [
  { value: "one_piece", label: "One-piece" },
  { value: "two_piece", label: "Two-piece" },
  { value: "three_piece", label: "Three-piece" },
];

export default function NewLotPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [suitType, setSuitType] = useState<LotCreateRequest["suit_type"]>("two_piece");
  const [totalSuitCount, setTotalSuitCount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listBranches(), listParties()])
      .then(([branchesData, partiesData]) => {
        setBranches(branchesData);
        setParties(partiesData);
      })
      .catch(() => setLoadError("Could not load branches/parties."));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createLot({
        branch_id: branchId,
        party_id: partyId,
        received_date: receivedDate,
        suit_type: suitType,
        total_suit_count: Number(totalSuitCount),
        notes: notes || undefined,
      });
      router.push(`/lots/${created.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">New Lot</h1>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-6 shadow">
        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700">Party</label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Received date</label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Suit type</label>
            <select
              value={suitType}
              onChange={(e) => setSuitType(e.target.value as LotCreateRequest["suit_type"])}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {SUIT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Total suit count</label>
          <input
            type="number"
            min={1}
            value={totalSuitCount}
            onChange={(e) => setTotalSuitCount(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="submit"
            disabled={submitting || !branchId || !partyId || !totalSuitCount}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creating..." : "Create lot"}
          </button>
        </div>
      </form>
    </div>
  );
}
