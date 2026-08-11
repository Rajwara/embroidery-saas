"use client";

import { useCallback, useEffect, useState } from "react";

import { listBranches } from "@embroidery/types";
import type { BranchOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setBranches(null);
    listBranches()
      .then(setBranches)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view branches.");
        } else {
          setError("Could not load branches.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Branches</h1>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && branches === null && <p className="text-sm text-gray-500">Loading branches...</p>}

      {!error && branches !== null && branches.length === 0 && (
        <p className="text-sm text-gray-500">No branches found.</p>
      )}

      {!error && branches !== null && branches.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">City</th>
              <th className="px-4 py-2 font-medium">Head office</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">{branch.name}</td>
                <td className="px-4 py-2">{branch.code}</td>
                <td className="px-4 py-2">{branch.city ?? "—"}</td>
                <td className="px-4 py-2">{branch.is_head_office ? "Yes" : "No"}</td>
                <td className="px-4 py-2">{branch.is_active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
