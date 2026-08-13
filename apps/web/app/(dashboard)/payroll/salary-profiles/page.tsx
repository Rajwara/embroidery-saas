"use client";

import { useCallback, useEffect, useState } from "react";

import { createSalaryProfile, listEmployees, listSalaryProfiles, updateSalaryProfile } from "@embroidery/types";
import type { EmployeeOut, EmployeeSalaryProfileOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SalaryProfilesPage() {
  const { hasPermission } = useAuth();
  const [profiles, setProfiles] = useState<EmployeeSalaryProfileOut[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSalary, setEditSalary] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setProfiles(null);
    Promise.all([listSalaryProfiles(), listEmployees()])
      .then(([profilesData, employeesData]) => {
        setProfiles(profilesData);
        setEmployees(employeesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view payroll.");
        } else {
          setError("Could not load salary profiles.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const employeesWithoutProfile = employees.filter(
    (employee) => !profiles?.some((p) => p.employee_id === employee.id)
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createSalaryProfile({
        employee_id: employeeId,
        basic_salary: Number(basicSalary),
        notes: notes || undefined,
      });
      setEmployeeId("");
      setBasicSalary("");
      setNotes("");
      load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (profile: EmployeeSalaryProfileOut) => {
    setEditingId(profile.id);
    setEditSalary(String(profile.basic_salary));
  };

  const saveEdit = async (profileId: string) => {
    setEditSaving(true);
    try {
      await updateSalaryProfile(profileId, { basic_salary: Number(editSalary) });
      setEditingId(null);
      load();
    } catch {
      // leave the row in edit mode so the user can retry
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Employee Salary Profiles</h1>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && profiles === null && <p className="text-sm text-gray-500">Loading salary profiles...</p>}

      {!error && profiles !== null && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Employee</th>
              <th className="px-4 py-2 font-medium">Basic salary</th>
              <th className="px-4 py-2 font-medium">Notes</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">{profile.employee_name}</td>
                <td className="px-4 py-2">
                  {editingId === profile.id ? (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editSalary}
                      onChange={(e) => setEditSalary(e.target.value)}
                      className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  ) : (
                    profile.basic_salary.toFixed(2)
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500">{profile.notes ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {hasPermission("payroll.create") &&
                    (editingId === profile.id ? (
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => saveEdit(profile.id)}
                          disabled={editSaving}
                          className="text-xs font-medium text-gray-900 underline disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs font-medium text-gray-500 underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(profile)}
                        className="text-xs font-medium text-gray-700 underline"
                      >
                        Edit
                      </button>
                    ))}
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No salary profiles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {hasPermission("payroll.create") && (
        <form onSubmit={handleCreate} className="max-w-md space-y-4 rounded bg-white p-6 shadow">
          <h2 className="text-sm font-semibold">Add salary profile</h2>
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
              {employeesWithoutProfile.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Basic salary</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={submitting || !employeeId || !basicSalary}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Adding..." : "Add profile"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
