"use client";

import { useState } from "react";

import { createStockTransaction } from "@embroidery/types";
import type { InventoryItemOut, StockTransactionOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

type TransactionType = "receipt" | "issue" | "adjustment";

interface AddTransactionFormProps {
  item: InventoryItemOut;
  onCreated: (transaction: StockTransactionOut) => void;
}

export function AddTransactionForm({ item, onCreated }: AddTransactionFormProps) {
  const [transactionType, setTransactionType] = useState<TransactionType>("receipt");
  const [quantity, setQuantity] = useState("");
  const [adjustmentDirection, setAdjustmentDirection] = useState<"increase" | "decrease">("increase");
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createStockTransaction(item.id, {
        transaction_type: transactionType,
        quantity: Number(quantity),
        adjustment_direction: transactionType === "adjustment" ? adjustmentDirection : undefined,
        transaction_date: transactionDate,
        notes: notes || undefined,
      });
      setQuantity("");
      setNotes("");
      onCreated(created);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded bg-white p-4 shadow">
      <h3 className="text-sm font-semibold">Add stock transaction</h3>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={transactionType}
          onChange={(e) => setTransactionType(e.target.value as TransactionType)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="receipt">Receipt</option>
          <option value="issue">Issue</option>
          <option value="adjustment">Adjustment</option>
        </select>
        {transactionType === "adjustment" && (
          <select
            value={adjustmentDirection}
            onChange={(e) => setAdjustmentDirection(e.target.value as "increase" | "decrease")}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="increase">Increase</option>
            <option value="decrease">Decrease</option>
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min={1}
          placeholder={`Quantity (${item.unit})`}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          required
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <input
        type="text"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />

      {submitError && <p className="text-xs text-red-600">{submitError}</p>}

      <button
        type="submit"
        disabled={submitting || !quantity}
        className="w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Saving..." : "Add transaction"}
      </button>
    </form>
  );
}
