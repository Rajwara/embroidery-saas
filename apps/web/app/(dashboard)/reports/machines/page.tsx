"use client";

import { useCallback, useEffect, useState } from "react";

import { getMachineCostReport, listBranches } from "@embroidery/types";
import type { BranchOut, MachineCostReportOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MachineCostReportPage() {
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState("");

  const [report, setReport] = useState<MachineCostReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const load = useCallback(() => {
    setError(null);
    setReport(null);
    getMachineCostReport({ date_from: dateFrom, date_to: dateTo, branch_id: branchId || undefined })
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reports.");
        } else if (err instanceof ApiError && err.status === 400) {
          setError("The 'from' date must be before the 'to' date.");
        } else {
          setError("Could not load the machine cost report.");
        }
      });
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Machine Cost Report</h1>
        <p className="text-sm text-gray-500">
          Overhead expenses for the period are split equally across active machines in scope.
          Revenue and profit aren&apos;t computed yet -- see the report notes below.
        </p>
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
          <div className="grid max-w-md grid-cols-2 gap-4 rounded bg-white p-4 text-sm shadow">
            <div>
              <p className="text-gray-500">Total overhead ({report.branch_id ? branchName(report.branch_id) : "all branches"})</p>
              <p className="text-lg font-semibold">{report.total_overhead.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500">Active machines</p>
              <p className="text-lg font-semibold">{report.active_machine_count}</p>
            </div>
          </div>

          <table className="w-full rounded bg-white text-sm shadow">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Machine</th>
                <th className="px-4 py-2 font-medium">Quantity produced</th>
                <th className="px-4 py-2 font-medium">Overhead share</th>
                <th className="px-4 py-2 font-medium">Cost per unit</th>
              </tr>
            </thead>
            <tbody>
              {report.machines.map((machine) => (
                <tr key={machine.machine_id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2">{machine.machine_name ?? machine.machine_code}</td>
                  <td className="px-4 py-2">{machine.quantity_produced}</td>
                  <td className="px-4 py-2">{machine.overhead_share.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {machine.cost_per_unit === null ? "—" : machine.cost_per_unit.toFixed(2)}
                  </td>
                </tr>
              ))}
              {report.machines.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No active machines in scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
