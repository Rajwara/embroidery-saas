"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { listPayments, listParties } from "@embroidery/types";
import type { Party, PaymentOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

export default function PaymentsPage() {
  const { hasPermission } = useAuth();
  const [payments, setPayments] = useState<PaymentOut[] | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPayments(null);
    Promise.all([listPayments(), listParties()])
      .then(([paymentsData, partiesData]) => {
        setPayments(paymentsData);
        setParties(partiesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view payments.");
        } else {
          setError("Could not load payments.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payments</h1>
        {hasPermission("payments.create") && (
          <Link
            href="/payments/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            New Payment
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

      {!error && payments === null && <p className="text-sm text-gray-500">Loading payments...</p>}

      {!error && payments !== null && payments.length === 0 && (
        <p className="text-sm text-gray-500">No payments found.</p>
      )}

      {!error && payments !== null && payments.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Payment #</th>
              <th className="px-4 py-2 font-medium">Party</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Method</th>
              <th className="px-4 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/payments/${payment.id}`} className="font-medium text-gray-900 underline">
                    {payment.payment_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{partyName(payment.party_id)}</td>
                <td className="px-4 py-2">{payment.payment_date}</td>
                <td className="px-4 py-2">{METHOD_LABELS[payment.payment_method] ?? payment.payment_method}</td>
                <td className="px-4 py-2">{payment.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
