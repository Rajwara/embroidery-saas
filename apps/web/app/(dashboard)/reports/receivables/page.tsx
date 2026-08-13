"use client";

import { useCallback, useEffect, useState } from "react";

import { getReceivableAgeingReport } from "@embroidery/types";
import type { ReceivableAgeingReportOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReceivableAgeingReportPage() {
  const [asOf, setAsOf] = useState(today);
  const [report, setReport] = useState<ReceivableAgeingReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setReport(null);
    getReceivableAgeingReport({ as_of: asOf })
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reports.");
        } else {
          setError("Could not load the receivable ageing report.");
        }
      });
  }, [asOf]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Receivable Ageing</h1>
        <p className="text-sm text-gray-500">
          Outstanding invoice balances by party, aged since each invoice&apos;s date.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded bg-white p-4 shadow">
        <div>
          <label className="block text-xs font-medium text-gray-600">As of</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && report === null && <p className="text-sm text-gray-500">Loading report...</p>}

      {!error && report !== null && (
        <>
          <div className="grid max-w-2xl grid-cols-5 gap-4 rounded bg-white p-4 text-sm shadow">
            <div>
              <p className="text-gray-500">Total outstanding</p>
              <p className="text-lg font-semibold">{report.total_outstanding.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500">0-30 days</p>
              <p className="font-semibold">{report.buckets.current.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500">31-60 days</p>
              <p className="font-semibold">{report.buckets.days_31_60.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500">61-90 days</p>
              <p className="font-semibold">{report.buckets.days_61_90.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500">90+ days</p>
              <p className="font-semibold">{report.buckets.days_over_90.toFixed(2)}</p>
            </div>
          </div>

          <table className="w-full rounded bg-white text-sm shadow">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Party</th>
                <th className="px-4 py-2 font-medium">Outstanding</th>
                <th className="px-4 py-2 font-medium">0-30</th>
                <th className="px-4 py-2 font-medium">31-60</th>
                <th className="px-4 py-2 font-medium">61-90</th>
                <th className="px-4 py-2 font-medium">90+</th>
              </tr>
            </thead>
            <tbody>
              {report.parties.map((party) => (
                <tr key={party.party_id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2">{party.party_name}</td>
                  <td className="px-4 py-2 font-semibold">{party.total_outstanding.toFixed(2)}</td>
                  <td className="px-4 py-2">{party.buckets.current.toFixed(2)}</td>
                  <td className="px-4 py-2">{party.buckets.days_31_60.toFixed(2)}</td>
                  <td className="px-4 py-2">{party.buckets.days_61_90.toFixed(2)}</td>
                  <td className="px-4 py-2">{party.buckets.days_over_90.toFixed(2)}</td>
                </tr>
              ))}
              {report.parties.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No outstanding balances.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
