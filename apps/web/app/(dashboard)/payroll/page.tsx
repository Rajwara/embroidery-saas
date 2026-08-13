"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { listBranches, listPayrollRuns } from "@embroidery/types";
import type { BranchOut, PayrollRunOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

import { StatusBadge } from "./_components/StatusBadge";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PayrollPage() {
  const { hasPermission } = useAuth();
  const [runs, setRuns] = useState<PayrollRunOut[] | null>(null);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRuns(null);
    Promise.all([listPayrollRuns(), listBranches()])
      .then(([runsData, branchesData]) => {
        setRuns(runsData);
        setBranches(branchesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view payroll.");
        } else {
          setError("Could not load payroll runs.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <div className="flex items-center gap-4">
          <Link href="/payroll/salary-profiles" className="text-sm font-medium text-gray-700 underline">
            Salary Profiles
          </Link>
          <Link href="/payroll/advances" className="text-sm font-medium text-gray-700 underline">
            Advances
          </Link>
          {hasPermission("payroll.create") && (
            <Link
              href="/payroll/new"
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              New Payroll Run
            </Link>
          )}
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

      {!error && runs === null && <p className="text-sm text-gray-500">Loading payroll runs...</p>}

      {!error && runs !== null && runs.length === 0 && (
        <p className="text-sm text-gray-500">No payroll runs found.</p>
      )}

      {!error && runs !== null && runs.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Period</th>
              <th className="px-4 py-2 font-medium">Branch</th>
              <th className="px-4 py-2 font-medium">Run date</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/payroll/${run.id}`} className="font-medium text-gray-900 underline">
                    {MONTH_NAMES[run.month - 1]} {run.year}
                  </Link>
                </td>
                <td className="px-4 py-2">{branchName(run.branch_id)}</td>
                <td className="px-4 py-2">{run.run_date}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={run.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
