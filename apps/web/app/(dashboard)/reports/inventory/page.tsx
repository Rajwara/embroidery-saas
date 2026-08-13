"use client";

import { useCallback, useEffect, useState } from "react";

import { getInventoryMovementReport, listBranches } from "@embroidery/types";
import type { BranchOut, InventoryMovementReportOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InventoryMovementReportPage() {
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState("");

  const [report, setReport] = useState<InventoryMovementReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const load = useCallback(() => {
    setError(null);
    setReport(null);
    getInventoryMovementReport({ date_from: dateFrom, date_to: dateTo, branch_id: branchId || undefined })
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reports.");
        } else if (err instanceof ApiError && err.status === 400) {
          setError("The 'from' date must be before the 'to' date.");
        } else {
          setError("Could not load the inventory movement report.");
        }
      });
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Inventory Movement</h1>
        <p className="text-sm text-gray-500">Opening stock, receipts, issues, and adjustments for the period.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded bg-white p-4 shadow">
        <div>
          <label className="block text-xs font-medium text-gray-600">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && report === null && <p className="text-sm text-gray-500">Loading report...</p>}

      {!error && report !== null && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Opening</th>
              <th className="px-4 py-2 font-medium">Receipts</th>
              <th className="px-4 py-2 font-medium">Issued</th>
              <th className="px-4 py-2 font-medium">Adjustments</th>
              <th className="px-4 py-2 font-medium">Closing</th>
            </tr>
          </thead>
          <tbody>
            {report.items.map((item) => (
              <tr key={item.inventory_item_id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  {item.item_name} <span className="text-gray-400">({item.unit})</span>
                </td>
                <td className="px-4 py-2">{item.opening_stock}</td>
                <td className="px-4 py-2">{item.receipts}</td>
                <td className="px-4 py-2">{Math.abs(item.issues)}</td>
                <td className="px-4 py-2">{item.adjustments}</td>
                <td className="px-4 py-2 font-semibold">{item.closing_stock}</td>
              </tr>
            ))}
            {report.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No active inventory items in scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
