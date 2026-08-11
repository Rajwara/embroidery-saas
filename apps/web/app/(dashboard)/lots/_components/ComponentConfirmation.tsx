"use client";

import { useState } from "react";

import { confirmLot, confirmLotComponent } from "@embroidery/types";
import type { LotColourWithComponentsOut, LotComponentOut, LotDetailOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const COMPONENT_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  sleeves: "Sleeves",
  trouser: "Trouser",
  dupatta: "Dupatta",
};

interface ComponentConfirmationProps {
  lot: LotDetailOut;
  onConfirmed: (updated: LotDetailOut) => void;
}

export function ComponentConfirmation({ lot, onConfirmed }: ComponentConfirmationProps) {
  const [colours, setColours] = useState<LotColourWithComponentsOut[]>(lot.colours);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const allConfirmed = colours.every((colour) => colour.components.every((c) => c.is_confirmed));

  const handleComponentConfirmed = (colourId: string, updated: LotComponentOut) => {
    setColours((prev) =>
      prev.map((colour) =>
        colour.id !== colourId
          ? colour
          : { ...colour, components: colour.components.map((c) => (c.id === updated.id ? updated : c)) },
      ),
    );
  };

  const handleConfirmLot = async () => {
    setConfirmError(null);
    setConfirming(true);
    try {
      const updated = await confirmLot(lot.id);
      onConfirmed(updated);
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Component confirmation</h2>
        <p className="text-sm text-gray-500">Confirm the actual counted quantity for each component.</p>
      </div>

      {colours.map((colour) => (
        <div key={colour.id} className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">
            {colour.colour_name} <span className="text-gray-400">({colour.suit_count} suits)</span>
          </h3>
          <ul className="divide-y divide-gray-100 rounded bg-white shadow">
            {colour.components.map((component) => (
              <ComponentRow
                key={component.id}
                lotId={lot.id}
                component={component}
                onConfirmed={(updated) => handleComponentConfirmed(colour.id, updated)}
              />
            ))}
          </ul>
        </div>
      ))}

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        {confirmError && <p className="text-sm text-red-600">{confirmError}</p>}
        <button
          onClick={handleConfirmLot}
          disabled={!allConfirmed || confirming}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {confirming ? "Confirming..." : "Confirm lot"}
        </button>
      </div>
    </div>
  );
}

interface ComponentRowProps {
  lotId: string;
  component: LotComponentOut;
  onConfirmed: (updated: LotComponentOut) => void;
}

function ComponentRow({ lotId, component, onConfirmed }: ComponentRowProps) {
  const [quantity, setQuantity] = useState(String(component.confirmed_quantity ?? component.expected_quantity));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const updated = await confirmLotComponent(lotId, component.id, { confirmed_quantity: Number(quantity) });
      onConfirmed(updated);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
      <span className="font-medium">{COMPONENT_LABELS[component.component_type] ?? component.component_type}</span>
      <span className="text-gray-500">Expected: {component.expected_quantity}</span>
      {component.is_confirmed ? (
        <span className="text-green-700">Confirmed: {component.confirmed_quantity}</span>
      ) : (
        <div className="flex items-center gap-2">
          {submitError && <span className="text-xs text-red-600">{submitError}</span>}
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            onClick={handleConfirm}
            disabled={submitting || quantity === ""}
            className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "..." : "Confirm"}
          </button>
        </div>
      )}
    </li>
  );
}
