"use client";

import { useCallback, useEffect, useState } from "react";

import { getPurchase, listSuppliers } from "@embroidery/types";
import type { PurchaseDetailOut, Supplier } from "@embroidery/types";

import { ApiError } from "@/lib/api";

export default function PurchaseDetailPage({ params }: { params: { id: string } }) {
  const [purchase, setPurchase] = useState<PurchaseDetailOut | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPurchase(null);
    Promise.all([getPurchase(params.id), listSuppliers()])
      .then(([purchaseData, suppliers]: [PurchaseDetailOut, Supplier[]]) => {
        setPurchase(purchaseData);
        setSupplierName(suppliers.find((s) => s.id === purchaseData.supplier_id)?.name ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Purchase not found.");
        } else {
          setError("Could not load purchase.");
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

  if (purchase === null) {
    return <p className="text-sm text-gray-500">Loading purchase...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{purchase.purchase_number}</h1>
        <p className="text-sm text-gray-500">
          {supplierName ?? "—"} &middot; {purchase.purchase_date}
        </p>
        {purchase.notes && <p className="mt-1 text-sm text-gray-500">{purchase.notes}</p>}
      </div>

      <table className="w-full rounded bg-white text-sm shadow">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="px-4 py-2 font-medium">Qty</th>
            <th className="px-4 py-2 font-medium">Unit price</th>
            <th className="px-4 py-2 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {purchase.lines.map((line) => (
            <tr key={line.id} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2">{line.description}</td>
              <td className="px-4 py-2">{line.quantity}</td>
              <td className="px-4 py-2">{line.unit_price.toFixed(2)}</td>
              <td className="px-4 py-2">{line.line_total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="px-4 py-2 text-right font-semibold">
              Total
            </td>
            <td className="px-4 py-2 font-semibold">{purchase.total_amount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
