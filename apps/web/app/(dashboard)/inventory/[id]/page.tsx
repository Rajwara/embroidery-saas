"use client";

import { useCallback, useEffect, useState } from "react";

import { getInventoryItem, listStockTransactions } from "@embroidery/types";
import type { InventoryItemOut, StockTransactionOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

import { AddTransactionForm } from "./_components/AddTransactionForm";

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  receipt: "Receipt",
  issue: "Issue",
  adjustment: "Adjustment",
};

export default function InventoryItemDetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<InventoryItemOut | null>(null);
  const [transactions, setTransactions] = useState<StockTransactionOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setItem(null);
    setTransactions(null);
    Promise.all([getInventoryItem(params.id), listStockTransactions(params.id)])
      .then(([itemData, transactionsData]) => {
        setItem(itemData);
        setTransactions(transactionsData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Inventory item not found.");
        } else {
          setError("Could not load inventory item.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTransactionCreated = (transaction: StockTransactionOut) => {
    setTransactions((prev) => (prev ? [transaction, ...prev] : [transaction]));
    getInventoryItem(params.id).then(setItem);
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

  if (item === null) {
    return <p className="text-sm text-gray-500">Loading item...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{item.name}</h1>
          <p className="text-sm text-gray-500">
            {item.category ?? "—"} &middot; unit: {item.unit}
          </p>
          {item.notes && <p className="mt-1 text-sm text-gray-500">{item.notes}</p>}
        </div>
        <div className="text-right">
          <div className={`text-2xl font-semibold ${item.is_below_threshold ? "text-red-700" : ""}`}>
            {item.current_stock} {item.unit}
          </div>
          <div className="text-xs text-gray-500">threshold: {item.minimum_threshold}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Transaction history</h2>
          {transactions === null && <p className="text-sm text-gray-500">Loading...</p>}
          {transactions !== null && transactions.length === 0 && (
            <p className="text-sm text-gray-500">No transactions yet.</p>
          )}
          {transactions !== null && transactions.length > 0 && (
            <table className="w-full rounded bg-white text-sm shadow">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2">{t.transaction_date}</td>
                    <td className="px-3 py-2">{TRANSACTION_TYPE_LABELS[t.transaction_type] ?? t.transaction_type}</td>
                    <td className={`px-3 py-2 ${t.quantity < 0 ? "text-red-700" : "text-green-700"}`}>
                      {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <AddTransactionForm item={item} onCreated={handleTransactionCreated} />
      </div>
    </div>
  );
}
