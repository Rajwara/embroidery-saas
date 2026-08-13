"use client";

import { useCallback, useEffect, useState } from "react";

import { getFinancialSummaryReport, listBranches } from "@embroidery/types";
import type { BranchOut, FinancialSummaryReportOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FinancialSummaryReportPage() {
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState("");

  const [report, setReport] = useState<FinancialSummaryReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const load = useCallback(() => {
    setError(null);
    setReport(null);
    getFinancialSummaryReport({ date_from: dateFrom, date_to: dateTo, branch_id: branchId || undefined })
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reports.");
        } else if (err instanceof ApiError && err.status === 400) {
          setError("The 'from' date must be before the 'to' date.");
        } else {
          setError("Could not load the financial summary.");
        }
      });
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Financial Summary</h1>
        <p className="text-sm text-gray-500">Invoiced revenue vs. expenses and purchases for the period.</p>
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
        <table className="w-full max-w-md rounded bg-white text-sm shadow">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="px-4 py-3">Revenue (invoiced)</td>
              <td className="px-4 py-3 text-right font-semibold">{report.revenue.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-4 py-3">Expenses</td>
              <td className="px-4 py-3 text-right font-semibold text-red-600">
                -{report.expenses.toFixed(2)}
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-4 py-3">Purchases</td>
              <td className="px-4 py-3 text-right font-semibold text-red-600">
                -{report.purchases.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold">Net</td>
              <td className={`px-4 py-3 text-right text-base font-bold ${report.net < 0 ? "text-red-600" : "text-green-700"}`}>
                {report.net.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
