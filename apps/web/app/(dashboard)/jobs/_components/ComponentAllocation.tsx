"use client";

import { useState } from "react";

import { allocateProductionJobComponent } from "@embroidery/types";
import type { MachineOut, ProductionJobComponentWithAllocationsOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const COMPONENT_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  sleeves: "Sleeves",
  trouser: "Trouser",
  dupatta: "Dupatta",
};

interface ComponentAllocationProps {
  jobId: string;
  component: ProductionJobComponentWithAllocationsOut;
  machines: MachineOut[];
  onAllocated: (updated: ProductionJobComponentWithAllocationsOut) => void;
}

export function ComponentAllocation({ jobId, component, machines, onAllocated }: ComponentAllocationProps) {
  const [selectedMachineIds, setSelectedMachineIds] = useState<Set<string>>(
    () => new Set(component.allocations.map((a) => a.machine_id)),
  );
  const [customQuantities, setCustomQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(component.allocations.map((a) => [a.machine_id, String(a.allocated_quantity)])),
  );
  const [customMode, setCustomMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const allocatedTotal = component.allocations.reduce((sum, a) => sum + a.allocated_quantity, 0);
  const fullyAllocated = component.allocations.length > 0 && allocatedTotal === component.target_quantity;

  const toggleMachine = (machineId: string) => {
    setSelectedMachineIds((prev) => {
      const next = new Set(prev);
      if (next.has(machineId)) next.delete(machineId);
      else next.add(machineId);
      return next;
    });
  };

  const customSum = [...selectedMachineIds].reduce((sum, id) => sum + (Number(customQuantities[id]) || 0), 0);
  const customValid =
    selectedMachineIds.size > 0 &&
    [...selectedMachineIds].every((id) => customQuantities[id] !== undefined && customQuantities[id] !== "") &&
    customSum === component.target_quantity;

  const submit = async (mode: "auto" | "custom") => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const allocations = [...selectedMachineIds].map((machineId) => ({
        machine_id: machineId,
        quantity: mode === "custom" ? Number(customQuantities[machineId]) : undefined,
      }));
      const updated = await allocateProductionJobComponent(jobId, component.id, { allocations });
      onAllocated(updated);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded bg-white p-4 shadow">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {COMPONENT_LABELS[component.component_type] ?? component.component_type}
        </h3>
        <span className={`text-xs font-medium ${fullyAllocated ? "text-green-700" : "text-gray-500"}`}>
          {allocatedTotal} / {component.target_quantity} allocated
          {fullyAllocated && " ✓"}
        </span>
      </div>

      <div className="space-y-1">
        {machines.map((machine) => (
          <div key={machine.id} className="flex items-center gap-3 text-sm">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={selectedMachineIds.has(machine.id)}
                onChange={() => toggleMachine(machine.id)}
              />
              {machine.code}
              {machine.name ? ` – ${machine.name}` : ""}
            </label>
            {customMode && selectedMachineIds.has(machine.id) && (
              <input
                type="number"
                min={0}
                value={customQuantities[machine.id] ?? ""}
                onChange={(e) =>
                  setCustomQuantities((prev) => ({ ...prev, [machine.id]: e.target.value }))
                }
                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => setCustomMode((v) => !v)}
          className="text-xs font-medium text-gray-500 underline"
        >
          {customMode ? "Use even auto-split instead" : "Enter custom amounts instead"}
        </button>
      </div>

      {submitError && <p className="text-xs text-red-600">{submitError}</p>}

      <div className="flex justify-end gap-2">
        {customMode ? (
          <button
            type="button"
            onClick={() => submit("custom")}
            disabled={submitting || !customValid}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving..." : `Save custom split (${customSum}/${component.target_quantity})`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit("auto")}
            disabled={submitting || selectedMachineIds.size === 0}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving..." : "Auto-split evenly"}
          </button>
        )}
      </div>
    </div>
  );
}
