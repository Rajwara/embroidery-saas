"use client";

import { useCallback, useEffect, useState } from "react";

import {
  addAdvanceInstallment,
  addBonus,
  addDeduction,
  approvePayrollRun,
  getPayrollRun,
  listAdvances,
} from "@embroidery/types";
import type { AdvanceOut, PayrollEntryOut, PayrollRunDetailOut } from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

import { StatusBadge } from "../_components/StatusBadge";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type AdjustmentType = "bonus" | "deduction" | "advance_installment";

export default function PayrollRunDetailPage({ params }: { params: { id: string } }) {
  const { hasPermission } = useAuth();
  const [run, setRun] = useState<PayrollRunDetailOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("bonus");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [installmentDate, setInstallmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [openAdvances, setOpenAdvances] = useState<AdvanceOut[]>([]);
  const [advanceId, setAdvanceId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRun(null);
    getPayrollRun(params.id)
      .then(setRun)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Payroll run not found.");
        } else {
          setError("Could not load payroll run.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (adjustmentType !== "advance_installment" || !employeeId) {
      setOpenAdvances([]);
      setAdvanceId("");
      return;
    }
    listAdvances({ employee_id: employeeId, open_only: true })
      .then((advances) => {
        setOpenAdvances(advances);
        setAdvanceId(advances[0]?.id ?? "");
      })
      .catch(() => setOpenAdvances([]));
  }, [adjustmentType, employeeId]);

  const resetForm = () => {
    setAmount("");
    setReason("");
    setAdvanceId("");
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!run) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const amountNum = Number(amount);
      if (adjustmentType === "bonus") {
        await addBonus(run.id, { employee_id: employeeId, amount: amountNum, reason: reason || undefined });
      } else if (adjustmentType === "deduction") {
        await addDeduction(run.id, { employee_id: employeeId, amount: amountNum, reason: reason || undefined });
      } else {
        if (!advanceId) {
          setFormError("Select an advance to recover against.");
          setSubmitting(false);
          return;
        }
        await addAdvanceInstallment(run.id, {
          employee_id: employeeId,
          advance_id: advanceId,
          amount: amountNum,
          installment_date: installmentDate,
        });
      }
      resetForm();
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!run) return;
    if (!window.confirm("Approve this payroll run? No further bonuses, deductions, or advance recoveries can be added afterward.")) {
      return;
    }
    setApproveError(null);
    setApproving(true);
    try {
      const updated = await approvePayrollRun(run.id);
      setRun(updated);
    } catch (err) {
      setApproveError(err instanceof ApiError ? err.detail : "Could not approve payroll run.");
    } finally {
      setApproving(false);
    }
  };

  const handlePrint = async (entry: PayrollEntryOut) => {
    setPdfError(null);
    setPdfLoadingId(entry.id);
    try {
      const blob = await fetchPdfBlob(`/payroll-runs/${params.id}/entries/${entry.employee_id}/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setPdfError("Could not generate the salary slip. Please try again.");
    } finally {
      setPdfLoadingId(null);
    }
  };

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

  if (run === null) {
    return <p className="text-sm text-gray-500">Loading payroll run...</p>;
  }

  const isDraft = run.status === "draft";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {MONTH_NAMES[run.month - 1]} {run.year}
          </h1>
          <p className="text-sm text-gray-500">Run date: {run.run_date}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={run.status} />
          {isDraft && hasPermission("payroll.approve") && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {approving ? "Approving..." : "Approve payroll run"}
            </button>
          )}
        </div>
      </div>

      {approveError && <p className="text-sm text-red-600">{approveError}</p>}
      {pdfError && <p className="text-sm text-red-600">{pdfError}</p>}

      <table className="w-full rounded bg-white text-sm shadow">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Employee</th>
            <th className="px-4 py-2 font-medium">Basic</th>
            <th className="px-4 py-2 font-medium">Bonus</th>
            <th className="px-4 py-2 font-medium">Deduction</th>
            <th className="px-4 py-2 font-medium">Advance recovery</th>
            <th className="px-4 py-2 font-medium">Net pay</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {run.entries.map((entry) => (
            <tr key={entry.id} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2">{entry.employee_name}</td>
              <td className="px-4 py-2">{entry.basic_salary.toFixed(2)}</td>
              <td className="px-4 py-2">{entry.total_bonus.toFixed(2)}</td>
              <td className="px-4 py-2">{entry.total_deduction.toFixed(2)}</td>
              <td className="px-4 py-2">{entry.total_advance_recovery.toFixed(2)}</td>
              <td className="px-4 py-2 font-semibold">{entry.net_pay.toFixed(2)}</td>
              <td className="px-4 py-2">
                <button
                  onClick={() => handlePrint(entry)}
                  disabled={pdfLoadingId === entry.id}
                  className="text-xs font-medium text-gray-700 underline disabled:opacity-40"
                >
                  {pdfLoadingId === entry.id ? "Generating..." : "Salary slip"}
                </button>
              </td>
            </tr>
          ))}
          {run.entries.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                No entries in this payroll run.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isDraft && hasPermission("payroll.create") && (
        <form onSubmit={handleAddAdjustment} className="space-y-4 rounded bg-white p-6 shadow">
          <h2 className="text-sm font-semibold">Add bonus, deduction, or advance recovery</h2>
          <div className="grid grid-cols-2 gap-4">
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
                {run.entries.map((entry) => (
                  <option key={entry.employee_id} value={entry.employee_id}>
                    {entry.employee_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as AdjustmentType)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="bonus">Bonus</option>
                <option value="deduction">Deduction</option>
                <option value="advance_installment">Advance recovery</option>
              </select>
            </div>
          </div>

          {adjustmentType === "advance_installment" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Advance</label>
              <select
                value={advanceId}
                onChange={(e) => setAdvanceId(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  {employeeId ? "Select an advance" : "Select an employee first"}
                </option>
                {openAdvances.map((advance) => (
                  <option key={advance.id} value={advance.id}>
                    {advance.advance_date} &middot; remaining {advance.remaining_balance.toFixed(2)}
                  </option>
                ))}
              </select>
              {employeeId && openAdvances.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">This employee has no open advances.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
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
            {adjustmentType === "advance_installment" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">Installment date</label>
                <input
                  type="date"
                  value={installmentDate}
                  onChange={(e) => setInstallmentDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700">Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={submitting || !employeeId || !amount}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
