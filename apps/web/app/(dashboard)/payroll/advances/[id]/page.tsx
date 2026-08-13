"use client";

import { useCallback, useEffect, useState } from "react";

import { getAdvance } from "@embroidery/types";
import type { AdvanceDetailOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

export default function AdvanceDetailPage({ params }: { params: { id: string } }) {
  const [advance, setAdvance] = useState<AdvanceDetailOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setAdvance(null);
    getAdvance(params.id)
      .then(setAdvance)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Advance not found.");
        } else {
          setError("Could not load advance.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

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

  if (advance === null) {
    return <p className="text-sm text-gray-500">Loading advance...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{advance.employee_name}</h1>
        <p className="text-sm text-gray-500">
          Advance of {advance.amount.toFixed(2)} on {advance.advance_date}
        </p>
        {advance.reason && <p className="mt-1 text-sm text-gray-500">{advance.reason}</p>}
      </div>

      <div className="grid max-w-sm grid-cols-2 gap-4 rounded bg-white p-4 text-sm shadow">
        <div>
          <p className="text-gray-500">Amount</p>
          <p className="font-semibold">{advance.amount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-500">Remaining balance</p>
          <p className="font-semibold">{advance.remaining_balance.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Recovery history</h2>
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {advance.installments.map((installment) => (
              <tr key={installment.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">{installment.installment_date}</td>
                <td className="px-4 py-2">{installment.amount.toFixed(2)}</td>
              </tr>
            ))}
            {advance.installments.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-gray-500">
                  No recoveries recorded yet. Record one from the relevant payroll run.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
