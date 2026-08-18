"use client";

import { useCallback, useEffect, useState, use } from "react";

import { getProductionJob, listMachines } from "@embroidery/types";
import type { MachineOut, ProductionJobComponentWithAllocationsOut, ProductionJobDetailOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

import { ComponentAllocation } from "../_components/ComponentAllocation";
import { StatusBadge } from "../_components/StatusBadge";

export default function ProductionJobDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [job, setJob] = useState<ProductionJobDetailOut | null>(null);
  const [machines, setMachines] = useState<MachineOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setJob(null);
    Promise.all([getProductionJob(params.id), listMachines()])
      .then(([jobData, machinesData]) => {
        setJob(jobData);
        setMachines(machinesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Production job not found.");
        } else {
          setError("Could not load production job.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleComponentAllocated = (updated: ProductionJobComponentWithAllocationsOut) => {
    setJob((prev) => {
      if (!prev) return prev;
      const components = prev.components.map((c) => (c.id === updated.id ? updated : c));
      const fullyAllocated = components.every(
        (c) => c.allocations.reduce((sum, a) => sum + a.allocated_quantity, 0) === c.target_quantity,
      );
      return { ...prev, components, status: fullyAllocated ? "allocated" : "draft" };
    });
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>{error}</span>
        <button onClick={load} className="font-medium underline">
          Retry
        </button>
      </div>
    );
  }

  if (job === null) {
    return <p className="text-sm text-gray-500">Loading production job...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{job.lot_number}</h1>
          <p className="text-sm text-gray-500">
            {job.colour_name} &middot; {job.design_master_number} ({job.design_name})
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Colour allocation</h2>
          <p className="text-sm text-gray-500">
            Pick machines for each component, then auto-split its target quantity evenly or enter a custom
            breakdown.
          </p>
        </div>

        {machines.length === 0 && (
          <p className="text-sm text-gray-500">No machines available to allocate to yet.</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {job.components.map((component) => (
            <ComponentAllocation
              key={component.id}
              jobId={job.id}
              component={component}
              machines={machines}
              onAllocated={handleComponentAllocated}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
