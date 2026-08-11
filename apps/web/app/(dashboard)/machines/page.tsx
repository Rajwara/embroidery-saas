"use client";

import { useCallback, useEffect, useState } from "react";

import { listMachines } from "@embroidery/types";
import type { MachineOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

export default function MachinesPage() {
  const [machines, setMachines] = useState<MachineOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setMachines(null);
    listMachines()
      .then(setMachines)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view machines.");
        } else {
          setError("Could not load machines.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Machines</h1>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && machines === null && <p className="text-sm text-gray-500">Loading machines...</p>}

      {!error && machines !== null && machines.length === 0 && (
        <p className="text-sm text-gray-500">No machines found.</p>
      )}

      {!error && machines !== null && machines.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Heads</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((machine) => (
              <tr key={machine.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">{machine.code}</td>
                <td className="px-4 py-2">{machine.name ?? "—"}</td>
                <td className="px-4 py-2">{machine.machine_type ?? "—"}</td>
                <td className="px-4 py-2">{machine.number_of_heads ?? "—"}</td>
                <td className="px-4 py-2">{machine.is_active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
