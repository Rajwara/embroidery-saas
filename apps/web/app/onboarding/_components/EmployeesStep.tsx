"use client";

import { useEffect, useState } from "react";

import { createEmployee, listBranches, listEmployees } from "@embroidery/types";
import type { BranchOut, EmployeeCreateRequest, EmployeeOut } from "@embroidery/types";

import { EntityAddStep } from "./EntityAddStep";

interface EmployeesStepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function EmployeesStep({ onNext, onBack }: EmployeesStepProps) {
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
    <EntityAddStep<EmployeeOut, EmployeeCreateRequest>
      title="Employees"
      description="Add your staff. You can skip this and add them later."
      list={() => listEmployees()}
      create={createEmployee}
      emptyLabel="No employees added yet."
      onBack={onBack}
      onNext={onNext}
      renderItem={(employee) => (
        <span>
          <span className="font-medium">{employee.full_name}</span>
          {employee.employee_code && <span className="text-gray-500"> ({employee.employee_code})</span>}
          {employee.designation && <span className="text-gray-500"> — {employee.designation}</span>}
        </span>
      )}
      renderForm={({ add, submitting, submitError }) => (
        <EmployeeForm branches={branches ?? []} add={add} submitting={submitting} submitError={submitError} />
      )}
    />
  );
}

interface EmployeeFormProps {
  branches: BranchOut[];
  add: (body: EmployeeCreateRequest) => Promise<unknown>;
  submitting: boolean;
  submitError: string | null;
}

function EmployeeForm({ branches, add, submitting, submitError }: EmployeeFormProps) {
  const [branchId, setBranchId] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await add({
        branch_id: branchId,
        employee_code: employeeCode,
        full_name: fullName,
        designation: designation || undefined,
        phone: phone || undefined,
      });
      setEmployeeCode("");
      setFullName("");
      setDesignation("");
      setPhone("");
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
          <label className="block text-sm font-medium text-gray-700">Employee code</label>
          <input
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Designation</label>
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <button
        type="submit"
        disabled={submitting || !branchId || !employeeCode || !fullName}
        className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Adding..." : "Add employee"}
      </button>
    </form>
  );
}
