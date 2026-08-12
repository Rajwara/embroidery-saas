"use client";

import { useState } from "react";

import { createProductionEntry } from "@embroidery/types";
import type { EmployeeOut, MachineProductionEntryOut, ProductionJobMachineAllocationOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

interface AddEntryFormProps {
  allocation: ProductionJobMachineAllocationOut;
  componentLabel: string;
  entryDate: string;
  shift: "morning" | "evening" | "night";
  employees: EmployeeOut[];
  onSubmitted: (entry: MachineProductionEntryOut) => void;
}

export function AddEntryForm({
  allocation,
  componentLabel,
  entryDate,
  shift,
  employees,
  onSubmitted,
}: AddEntryFormProps) {
  const [operatorId, setOperatorId] = useState("");
  const [helperId, setHelperId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const entry = await createProductionEntry({
        production_job_machine_allocation_id: allocation.id,
        entry_date: entryDate,
        shift,
        operator_employee_id: operatorId,
        helper_employee_id: helperId || undefined,
        quantity: Number(quantity),
        notes: notes || undefined,
      });
      setLastSubmitted(entry.quantity);
      setQuantity("");
      setNotes("");
      onSubmitted(entry);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-gray-200 bg-gray-50 p-4">
      <div className="text-sm font-medium text-gray-700">
        {componentLabel} &middot; {allocation.machine_code} &middot; {allocation.remaining_quantity} remaining of{" "}
        {allocation.allocated_quantity}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600">Operator</label>
        <select
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Select operator
          </option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600">Helper (optional)</label>
        <select
          value={helperId}
          onChange={(e) => setHelperId(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">No helper</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600">Quantity produced</label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {submitError && <p className="text-xs text-red-600">{submitError}</p>}
      {lastSubmitted !== null && !submitError && (
        <p className="text-xs text-green-700">Logged {lastSubmitted} units -- pending approval.</p>
      )}

      <button
        type="submit"
        disabled={submitting || !operatorId || !quantity}
        className="w-full rounded bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Logging..." : "Log entry"}
      </button>
    </form>
  );
}
