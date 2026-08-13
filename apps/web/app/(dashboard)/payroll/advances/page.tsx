"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { createAdvance, listAdvances, listEmployees } from "@embroidery/types";
import type { AdvanceOut, EmployeeOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function AdvancesPage() {
  const { hasPermission } = useAuth();
  const [advances, setAdvances] = useState<AdvanceOut[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [advanceDate, setAdvanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setAdvances(null);
    Promise.all([listAdvances({ open_only: openOnly }), listEmployees()])
      .then(([advancesData, employeesData]) => {
        setAdvances(advancesData);
        setEmployees(employeesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view payroll.");
        } else {
          setError("Could not load advances.");
        }
      });
  }, [openOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createAdvance({
        employee_id: employeeId,
        advance_date: advanceDate,
        amount: Number(amount),
        reason: reason || undefined,
      });
      setEmployeeId("");
      setAmount("");
      setReason("");
      load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Advances</h1>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Open only
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && advances === null && <p className="text-sm text-gray-500">Loading advances...</p>}

      {!error && advances !== null && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Employee</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Remaining</th>
              <th className="px-4 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {advances.map((advance) => (
              <tr key={advance.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/payroll/advances/${advance.id}`} className="font-medium text-gray-900 underline">
                    {advance.employee_name}
                  </Link>
                </td>
                <td className="px-4 py-2">{advance.advance_date}</td>
                <td className="px-4 py-2">{advance.amount.toFixed(2)}</td>
                <td className="px-4 py-2">{advance.remaining_balance.toFixed(2)}</td>
                <td className="px-4 py-2 text-gray-500">{advance.reason ?? "—"}</td>
              </tr>
            ))}
            {advances.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No advances found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {hasPermission("payroll.create") && (
        <form onSubmit={handleCreate} className="max-w-md space-y-4 rounded bg-white p-6 shadow">
          <h2 className="text-sm font-semibold">Record advance</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select an employee
              </option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={advanceDate}
                onChange={(e) => setAdvanceDate(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={submitting || !employeeId || !amount}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Recording..." : "Record advance"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
