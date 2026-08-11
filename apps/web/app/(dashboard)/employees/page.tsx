"use client";

import { useCallback, useEffect, useState } from "react";

import { listEmployees } from "@embroidery/types";
import type { EmployeeOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setEmployees(null);
    listEmployees()
      .then(setEmployees)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view employees.");
        } else {
          setError("Could not load employees.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Employees</h1>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && employees === null && <p className="text-sm text-gray-500">Loading employees...</p>}

      {!error && employees !== null && employees.length === 0 && (
        <p className="text-sm text-gray-500">No employees found.</p>
      )}

      {!error && employees !== null && employees.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Designation</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">{employee.full_name}</td>
                <td className="px-4 py-2">{employee.employee_code}</td>
                <td className="px-4 py-2">{employee.designation ?? "—"}</td>
                <td className="px-4 py-2">{employee.phone ?? "—"}</td>
                <td className="px-4 py-2">{employee.is_active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
