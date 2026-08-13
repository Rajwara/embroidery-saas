"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { listPurchases, listSuppliers } from "@embroidery/types";
import type { PurchaseOut, Supplier } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function PurchasesPage() {
  const { hasPermission } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseOut[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPurchases(null);
    Promise.all([listPurchases(), listSuppliers()])
      .then(([purchasesData, suppliersData]) => {
        setPurchases(purchasesData);
        setSuppliers(suppliersData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view purchases.");
        } else {
          setError("Could not load purchases.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Purchases</h1>
        {hasPermission("purchases.create") && (
          <Link
            href="/purchases/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            New Purchase
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

      {!error && purchases === null && <p className="text-sm text-gray-500">Loading purchases...</p>}

      {!error && purchases !== null && purchases.length === 0 && (
        <p className="text-sm text-gray-500">No purchases found.</p>
      )}

      {!error && purchases !== null && purchases.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Purchase #</th>
              <th className="px-4 py-2 font-medium">Supplier</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => (
              <tr key={purchase.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/purchases/${purchase.id}`} className="font-medium text-gray-900 underline">
                    {purchase.purchase_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{supplierName(purchase.supplier_id)}</td>
                <td className="px-4 py-2">{purchase.purchase_date}</td>
                <td className="px-4 py-2">{purchase.total_amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
