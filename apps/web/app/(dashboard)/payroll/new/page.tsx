"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createPayrollRun, listBranches } from "@embroidery/types";
import type { BranchOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function NewPayrollRunPage() {
  const router = useRouter();

  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const now = new Date();
  const [branchId, setBranchId] = useState("");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [runDate, setRunDate] = useState(() => now.toISOString().slice(0, 10));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => setLoadError("Could not load branches."));
  }, []);

  const canSubmit = branchId && year && month && runDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createPayrollRun({
        branch_id: branchId,
        year: Number(year),
        month: Number(month),
        run_date: runDate,
      });
      router.push(`/payroll/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSubmitError("A payroll run already exists for this branch and period.");
      } else {
        setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">New Payroll Run</h1>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-6 shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700">Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select a branch
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Run date</label>
          <input
            type="date"
            value={runDate}
            onChange={(e) => setRunDate(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <p className="text-xs text-gray-500">
          One payroll entry will be created for each active employee at this branch who has a salary
          profile. Employees without a salary profile are skipped.
        </p>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creating..." : "Create payroll run"}
          </button>
        </div>
      </form>
    </div>
  );
}
