"use client";

import { useCallback, useEffect, useState, use } from "react";

import { getPayment, listParties } from "@embroidery/types";
import type { Party, PaymentDetailOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

const ALLOCATION_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  general: "General (against balance)",
  advance: "Advance",
  unallocated: "Unallocated",
};

export default function PaymentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [payment, setPayment] = useState<PaymentDetailOut | null>(null);
  const [partyName, setPartyName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPayment(null);
    Promise.all([getPayment(params.id), listParties()])
      .then(([paymentData, parties]: [PaymentDetailOut, Party[]]) => {
        setPayment(paymentData);
        setPartyName(parties.find((p) => p.id === paymentData.party_id)?.name ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Payment not found.");
        } else {
          setError("Could not load payment.");
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

  if (payment === null) {
    return <p className="text-sm text-gray-500">Loading payment...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{payment.payment_number}</h1>
        <p className="text-sm text-gray-500">
          {partyName ?? "—"} &middot; {payment.payment_date} &middot;{" "}
          {METHOD_LABELS[payment.payment_method] ?? payment.payment_method} &middot; {payment.amount.toFixed(2)}
        </p>
        {payment.notes && <p className="mt-1 text-sm text-gray-500">{payment.notes}</p>}
      </div>

      <table className="w-full rounded bg-white text-sm shadow">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Invoice</th>
            <th className="px-4 py-2 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {payment.allocations.map((allocation) => (
            <tr key={allocation.id} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2">{ALLOCATION_TYPE_LABELS[allocation.allocation_type] ?? allocation.allocation_type}</td>
              <td className="px-4 py-2">{allocation.invoice_number ?? "—"}</td>
              <td className="px-4 py-2">{allocation.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
