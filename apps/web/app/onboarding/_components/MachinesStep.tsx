"use client";

import { useEffect, useState } from "react";

import { createMachine, listBranches, listMachines } from "@embroidery/types";
import type { BranchOut, MachineCreateRequest, MachineOut } from "@embroidery/types";

import { EntityAddStep } from "./EntityAddStep";

interface MachinesStepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function MachinesStep({ onNext, onBack }: MachinesStepProps) {
  const [branches, setBranches] = useState<BranchOut[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listBranches()
      .then((data) => !cancelled && setBranches(data))
      .catch(() => !cancelled && setBranches([]));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <EntityAddStep<MachineOut, MachineCreateRequest>
      title="Machines"
      description="Add your embroidery machines. You can skip this and add them later."
      list={() => listMachines()}
      create={createMachine}
      emptyLabel="No machines added yet."
      onBack={onBack}
      onNext={onNext}
      renderItem={(machine) => (
        <span>
          <span className="font-medium">{machine.code}</span>
          {machine.name && <span className="text-gray-500"> — {machine.name}</span>}
          {machine.machine_type && <span className="text-gray-500"> ({machine.machine_type})</span>}
        </span>
      )}
      renderForm={({ add, submitting, submitError }) => (
        <MachineForm branches={branches ?? []} add={add} submitting={submitting} submitError={submitError} />
      )}
    />
  );
}

interface MachineFormProps {
  branches: BranchOut[];
  add: (body: MachineCreateRequest) => Promise<unknown>;
  submitting: boolean;
  submitError: string | null;
}

function MachineForm({ branches, add, submitting, submitError }: MachineFormProps) {
  const [branchId, setBranchId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [machineType, setMachineType] = useState("");
  const [numberOfHeads, setNumberOfHeads] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await add({
        branch_id: branchId,
        code,
        name: name || undefined,
        machine_type: machineType || undefined,
        number_of_heads: numberOfHeads ? Number(numberOfHeads) : undefined,
      });
      setCode("");
      setName("");
      setMachineType("");
      setNumberOfHeads("");
    } catch {
      // surfaced via submitError
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded bg-white p-4 shadow">
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Type</label>
          <input
            value={machineType}
            onChange={(e) => setMachineType(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Number of heads</label>
          <input
            type="number"
            min={0}
            value={numberOfHeads}
            onChange={(e) => setNumberOfHeads(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <button
        type="submit"
        disabled={submitting || !branchId || !code}
        className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Adding..." : "Add machine"}
      </button>
    </form>
  );
}
