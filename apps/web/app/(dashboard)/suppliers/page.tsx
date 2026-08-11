"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Supplier } from "@/types/supplier";

export default function SuppliersPage() {
  const { hasPermission } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSeeMoney = hasPermission("suppliers.see_money");

  const load = useCallback(() => {
    setError(null);
    setSuppliers(null);
    apiFetch<Supplier[]>("/suppliers")
      .then(setSuppliers)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view suppliers.");
        } else {
          setError("Could not load suppliers.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Suppliers</h1>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && suppliers === null && <p className="text-sm text-gray-500">Loading suppliers...</p>}

      {!error && suppliers !== null && suppliers.length === 0 && (
        <p className="text-sm text-gray-500">No suppliers found.</p>
      )}

      {!error && suppliers !== null && suppliers.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              {canSeeMoney && <th className="px-4 py-2 font-medium">Balance</th>}
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">{supplier.name}</td>
                <td className="px-4 py-2">{supplier.contact_person ?? "—"}</td>
                <td className="px-4 py-2">{supplier.phone ?? "—"}</td>
                {canSeeMoney && <td className="px-4 py-2">{supplier.opening_balance ?? "—"}</td>}
                <td className="px-4 py-2">{supplier.is_active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
