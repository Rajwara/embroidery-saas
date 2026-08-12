"use client";

import { useCallback, useEffect, useState } from "react";

import { getProductionJob, listEmployees, listProductionJobs } from "@embroidery/types";
import type {
  EmployeeOut,
  MachineProductionEntryOut,
  ProductionJobDetailOut,
  ProductionJobMachineAllocationOut,
  ProductionJobOut,
} from "@embroidery/types";

import { ApiError } from "@/lib/api";

import { AddEntryForm } from "./_components/AddEntryForm";

const SHIFT_OPTIONS: { value: "morning" | "evening" | "night"; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

const COMPONENT_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  sleeves: "Sleeves",
  trouser: "Trouser",
  dupatta: "Dupatta",
};

export default function DailyShiftPage() {
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<"morning" | "evening" | "night">("morning");

  const [jobs, setJobs] = useState<ProductionJobOut[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeOut[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobDetail, setJobDetail] = useState<ProductionJobDetailOut | null>(null);
  const [jobDetailError, setJobDetailError] = useState<string | null>(null);

  const [activeAllocationId, setActiveAllocationId] = useState<string | null>(null);

  const loadJobsAndEmployees = useCallback(() => {
    setLoadError(null);
    Promise.all([listProductionJobs(), listEmployees()])
      .then(([jobsData, employeesData]) => {
        setJobs(jobsData);
        setEmployees(employeesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setLoadError("You don't have permission to log production entries.");
        } else {
          setLoadError("Could not load jobs/employees.");
        }
      });
  }, []);

  useEffect(() => {
    loadJobsAndEmployees();
  }, [loadJobsAndEmployees]);

  const loadJobDetail = useCallback((jobId: string) => {
    setJobDetailError(null);
    setJobDetail(null);
    setActiveAllocationId(null);
    if (!jobId) return;
    getProductionJob(jobId)
      .then(setJobDetail)
      .catch(() => setJobDetailError("Could not load this job's components."));
  }, []);

  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    loadJobDetail(jobId);
  };

  const handleEntrySubmitted = (_entry: MachineProductionEntryOut) => {
    // Refresh remaining_quantity for the whole job so other allocations'
    // figures stay accurate too.
    if (selectedJobId) loadJobDetail(selectedJobId);
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Daily Shift</h1>

      <div className="grid grid-cols-2 gap-3 rounded bg-white p-4 shadow">
        <div>
          <label className="block text-xs font-medium text-gray-600">Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Shift</label>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as "morning" | "evening" | "night")}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {SHIFT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{loadError}</span>
          <button onClick={loadJobsAndEmployees} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!loadError && jobs === null && <p className="text-sm text-gray-500">Loading jobs...</p>}

      {!loadError && jobs !== null && (
        <div className="rounded bg-white p-4 shadow">
          <label className="block text-xs font-medium text-gray-600">Production job</label>
          <select
            value={selectedJobId}
            onChange={(e) => handleJobChange(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select a job</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.lot_number} &middot; {job.colour_name} &middot; {job.design_master_number}
              </option>
            ))}
          </select>
        </div>
      )}

      {jobDetailError && <p className="text-sm text-red-600">{jobDetailError}</p>}

      {selectedJobId && jobDetail === null && !jobDetailError && (
        <p className="text-sm text-gray-500">Loading job components...</p>
      )}

      {jobDetail !== null && (
        <div className="space-y-3">
          {jobDetail.components.map((component) => (
            <div key={component.id} className="rounded bg-white p-4 shadow">
              <h3 className="mb-2 text-sm font-semibold">
                {COMPONENT_LABELS[component.component_type] ?? component.component_type}
              </h3>
              {component.allocations.length === 0 && (
                <p className="text-xs text-gray-500">No machines allocated to this component yet.</p>
              )}
              <div className="space-y-2">
                {component.allocations.map((allocation: ProductionJobMachineAllocationOut) => (
                  <div key={allocation.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveAllocationId(activeAllocationId === allocation.id ? null : allocation.id)
                      }
                      className="flex w-full items-center justify-between rounded border border-gray-200 px-3 py-2 text-left text-sm"
                    >
                      <span>{allocation.machine_code}</span>
                      <span className="text-gray-500">
                        {allocation.remaining_quantity} / {allocation.allocated_quantity} remaining
                      </span>
                    </button>
                    {activeAllocationId === allocation.id && (
                      <div className="mt-2">
                        <AddEntryForm
                          allocation={allocation}
                          componentLabel={COMPONENT_LABELS[component.component_type] ?? component.component_type}
                          entryDate={entryDate}
                          shift={shift}
                          employees={employees}
                          onSubmitted={handleEntrySubmitted}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
