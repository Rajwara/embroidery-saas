"use client";

import { useCallback, useEffect, useState } from "react";

import { getMachinePerformance } from "@embroidery/types";
import type { MachinePerformanceOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { PerformanceBarChart } from "@/components/PerformanceBarChart";

export default function MachinePerformancePage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [rows, setRows] = useState<MachinePerformanceOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    getMachinePerformance({ start_date: startDate || undefined, end_date: endDate || undefined })
      .then(setRows)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view machine performance.");
        } else {
          setError("Could not load machine performance.");
        }
      });
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Machine Performance</h1>
      <p className="text-sm text-gray-500">
        Share of total approved production per machine{startDate || endDate ? " in the selected range" : ""}.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded bg-white p-4 shadow">
        <div>
          <label className="block text-xs font-medium text-gray-600">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
          >
            Clear
          </button>
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

      {!error && rows === null && <p className="text-sm text-gray-500">Loading...</p>}

      {!error && rows !== null && (
        <PerformanceBarChart
          rows={rows.map((r) => ({
            id: r.machine_id,
            label: r.machine_code,
            totalQuantity: r.total_quantity,
            entryCount: r.entry_count,
            percentageOfTotal: r.percentage_of_total,
            totalStitches: r.total_stitches,
            quantityMissingStitchCount: r.quantity_missing_stitch_count,
          }))}
          emptyMessage="No approved production entries yet."
        />
      )}
    </div>
  );
}
