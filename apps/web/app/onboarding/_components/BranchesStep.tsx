"use client";

import { useState } from "react";

import { createBranch, listBranches } from "@embroidery/types";
import type { BranchCreateRequest, BranchOut } from "@embroidery/types";

import { EntityAddStep } from "./EntityAddStep";

interface BranchesStepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function BranchesStep({ onNext, onBack }: BranchesStepProps) {
  return (
    <EntityAddStep<BranchOut, BranchCreateRequest>
      title="Branches"
      description="Add at least one branch. You'll assign machines and employees to branches next."
      list={() => listBranches()}
      create={createBranch}
      emptyLabel="No branches added yet."
      minRequired={1}
      requiredMessage="Add at least one branch to continue."
      onBack={onBack}
      onNext={onNext}
      renderItem={(branch) => (
        <span>
          <span className="font-medium">{branch.name}</span>{" "}
          <span className="text-gray-500">({branch.code})</span>
          {branch.city && <span className="text-gray-500"> — {branch.city}</span>}
          {branch.is_head_office && <span className="ml-2 text-xs text-gray-400">Head office</span>}
        </span>
      )}
      renderForm={({ add, submitting, submitError }) => (
        <BranchForm add={add} submitting={submitting} submitError={submitError} />
      )}
    />
  );
}

interface BranchFormProps {
  add: (body: BranchCreateRequest) => Promise<unknown>;
  submitting: boolean;
  submitError: string | null;
}

function BranchForm({ add, submitting, submitError }: BranchFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [isHeadOffice, setIsHeadOffice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await add({ name, code, city: city || undefined, is_head_office: isHeadOffice });
      setName("");
      setCode("");
      setCity("");
      setIsHeadOffice(false);
    } catch {
      // surfaced via submitError
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded bg-white p-4 shadow">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">City</label>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={isHeadOffice} onChange={(e) => setIsHeadOffice(e.target.checked)} />
        Head office
      </label>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <button
        type="submit"
        disabled={submitting || !name || !code}
        className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Adding..." : "Add branch"}
      </button>
    </form>
  );
}
