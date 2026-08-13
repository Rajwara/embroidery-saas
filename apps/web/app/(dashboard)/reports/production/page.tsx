"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { getProductionSummaryReport, listBranches } from "@embroidery/types";
import type { BranchOut, ProductionSummaryReportOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ProductionSummaryReportPage() {
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState("");

  const [report, setReport] = useState<ProductionSummaryReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const load = useCallback(() => {
    setError(null);
    setReport(null);
    getProductionSummaryReport({ date_from: dateFrom, date_to: dateTo, branch_id: branchId || undefined })
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reports.");
        } else if (err instanceof ApiError && err.status === 400) {
          setError("The 'from' date must be before the 'to' date.");
        } else {
          setError("Could not load the production summary.");
        }
      });
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Production Summary</h1>
        <p className="text-sm text-gray-500">Approved production quantity for the period, by component and by lot.</p>
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
        <>
          <div className="max-w-xs rounded bg-white p-4 text-sm shadow">
            <p className="text-gray-500">Total quantity produced</p>
            <p className="text-lg font-semibold">{report.total_quantity}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-semibold">By component</h2>
              <table className="w-full rounded bg-white text-sm shadow">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="px-4 py-2 font-medium">Component</th>
                    <th className="px-4 py-2 font-medium">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {report.by_component.map((row) => (
                    <tr key={row.component_type} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2 capitalize">{row.component_type}</td>
                      <td className="px-4 py-2">{row.quantity}</td>
                    </tr>
                  ))}
                  {report.by_component.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-500">
                        No approved production in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold">By lot</h2>
              <table className="w-full rounded bg-white text-sm shadow">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="px-4 py-2 font-medium">Lot</th>
                    <th className="px-4 py-2 font-medium">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {report.by_lot.map((row) => (
                    <tr key={row.lot_id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2">
                        <Link href={`/lots/${row.lot_id}`} className="font-medium text-gray-900 underline">
                          {row.lot_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{row.quantity}</td>
                    </tr>
                  ))}
                  {report.by_lot.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-500">
                        No approved production in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
