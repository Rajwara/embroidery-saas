"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { listInventoryItems } from "@embroidery/types";
import type { InventoryItemOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<InventoryItemOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setItems(null);
    listInventoryItems()
      .then(setItems)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view inventory.");
        } else {
          setError("Could not load inventory.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lowStockCount = items?.filter((i) => i.is_below_threshold).length ?? 0;
  const visibleItems = items?.filter((i) => !showLowStockOnly || i.is_below_threshold) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        {hasPermission("inventory.create") && (
          <Link
            href="/inventory/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            New Item
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

      {!error && items === null && <p className="text-sm text-gray-500">Loading inventory...</p>}

      {!error && items !== null && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded bg-white p-4 shadow">
            <div className="text-sm text-gray-500">Total items</div>
            <div className="text-2xl font-semibold">{items.length}</div>
          </div>
          <button
            onClick={() => setShowLowStockOnly((v) => !v)}
            className={`rounded p-4 text-left shadow ${lowStockCount > 0 ? "bg-red-50" : "bg-white"}`}
          >
            <div className="text-sm text-gray-500">Below threshold {showLowStockOnly ? "(showing)" : ""}</div>
            <div className={`text-2xl font-semibold ${lowStockCount > 0 ? "text-red-700" : ""}`}>
              {lowStockCount}
            </div>
          </button>
        </div>
      )}

      {!error && items !== null && visibleItems.length === 0 && (
        <p className="text-sm text-gray-500">No inventory items found.</p>
      )}

      {!error && items !== null && visibleItems.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Stock</th>
              <th className="px-4 py-2 font-medium">Threshold</th>
              <th className="px-4 py-2 font-medium">Unit</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/inventory/${item.id}`} className="font-medium text-gray-900 underline">
                    {item.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{item.category ?? "—"}</td>
                <td className={`px-4 py-2 ${item.is_below_threshold ? "font-semibold text-red-700" : ""}`}>
                  {item.current_stock}
                </td>
                <td className="px-4 py-2">{item.minimum_threshold}</td>
                <td className="px-4 py-2">{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
