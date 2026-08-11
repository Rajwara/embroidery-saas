"use client";

import { useState } from "react";

import { addLotColour, generateLotComponents, removeLotColour } from "@embroidery/types";
import type { LotColourOut, LotDetailOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

interface ColourBreakdownProps {
  lot: LotDetailOut;
  onGenerated: (updated: LotDetailOut) => void;
}

export function ColourBreakdown({ lot, onGenerated }: ColourBreakdownProps) {
  const [colours, setColours] = useState<LotColourOut[]>(lot.colours);
  const [colourName, setColourName] = useState("");
  const [suitCount, setSuitCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const sum = colours.reduce((acc, c) => acc + c.suit_count, 0);
  const remaining = lot.total_suit_count - sum;
  const canGenerate = sum === lot.total_suit_count && colours.length > 0;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await addLotColour(lot.id, { colour_name: colourName, suit_count: Number(suitCount) });
      setColours((prev) => [...prev, created]);
      setColourName("");
      setSuitCount("");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (colourId: string) => {
    setRemovingId(colourId);
    try {
      await removeLotColour(lot.id, colourId);
      setColours((prev) => prev.filter((c) => c.id !== colourId));
    } catch {
      // leave the row in place -- the retry is just clicking remove again
    } finally {
      setRemovingId(null);
    }
  };

  const handleGenerate = async () => {
    setGenerateError(null);
    setGenerating(true);
    try {
      const updated = await generateLotComponents(lot.id);
      onGenerated(updated);
    } catch (err) {
      setGenerateError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Colour breakdown</h2>
        <p className="text-sm text-gray-500">
          {sum} / {lot.total_suit_count} suits allocated
          {remaining !== 0 && ` (${remaining > 0 ? remaining : -remaining} ${remaining > 0 ? "remaining" : "over"})`}
        </p>
      </div>

      {colours.length === 0 ? (
        <p className="text-sm text-gray-500">No colours added yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded bg-white shadow">
          {colours.map((colour) => (
            <li key={colour.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                <span className="font-medium">{colour.colour_name}</span>{" "}
                <span className="text-gray-500">— {colour.suit_count} suits</span>
              </span>
              <button
                onClick={() => handleRemove(colour.id)}
                disabled={removingId === colour.id}
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
              >
                {removingId === colour.id ? "Removing..." : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-end gap-3 rounded bg-white p-4 shadow">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">Colour</label>
          <input
            value={colourName}
            onChange={(e) => setColourName(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700">Suits</label>
          <input
            type="number"
            min={1}
            value={suitCount}
            onChange={(e) => setSuitCount(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !colourName || !suitCount}
          className="rounded bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Adding..." : "Add colour"}
        </button>
      </form>
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        {generateError && <p className="text-sm text-red-600">{generateError}</p>}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? "Generating..." : "Generate components"}
        </button>
      </div>
    </div>
  );
}
