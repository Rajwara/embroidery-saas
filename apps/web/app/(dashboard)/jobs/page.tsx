"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { listProductionJobs } from "@embroidery/types";
import type { ProductionJobOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

import { StatusBadge } from "./_components/StatusBadge";

export default function ProductionJobsPage() {
  const { hasPermission } = useAuth();
  const [jobs, setJobs] = useState<ProductionJobOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setJobs(null);
    listProductionJobs()
      .then(setJobs)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view production jobs.");
        } else {
          setError("Could not load production jobs.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Production Jobs</h1>
        {hasPermission("production_jobs.create") && (
          <Link
            href="/jobs/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            New Job
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && jobs === null && <p className="text-sm text-gray-500">Loading production jobs...</p>}

      {!error && jobs !== null && jobs.length === 0 && (
        <p className="text-sm text-gray-500">No production jobs found.</p>
      )}

      {!error && jobs !== null && jobs.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Lot #</th>
              <th className="px-4 py-2 font-medium">Colour</th>
              <th className="px-4 py-2 font-medium">Design</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/jobs/${job.id}`} className="font-medium text-gray-900 underline">
                    {job.lot_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{job.colour_name}</td>
                <td className="px-4 py-2">
                  {job.design_master_number} &middot; {job.design_name}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={job.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
