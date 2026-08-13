"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { listInvoices, listParties } from "@embroidery/types";
import type { InvoiceOut, Party } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function InvoicesPage() {
  const { hasPermission } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceOut[] | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setInvoices(null);
    Promise.all([listInvoices(), listParties()])
      .then(([invoicesData, partiesData]) => {
        setInvoices(invoicesData);
        setParties(partiesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view invoices.");
        } else {
          setError("Could not load invoices.");
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
        <h1 className="text-2xl font-semibold">Invoices</h1>
        {hasPermission("invoices.create") && (
          <Link
            href="/invoices/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            New Invoice
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

      {!error && invoices === null && <p className="text-sm text-gray-500">Loading invoices...</p>}

      {!error && invoices !== null && invoices.length === 0 && (
        <p className="text-sm text-gray-500">No invoices found.</p>
      )}

      {!error && invoices !== null && invoices.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Invoice #</th>
              <th className="px-4 py-2 font-medium">Party</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Due</th>
              <th className="px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/invoices/${invoice.id}`} className="font-medium text-gray-900 underline">
                    {invoice.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{partyName(invoice.party_id)}</td>
                <td className="px-4 py-2">{invoice.invoice_date}</td>
                <td className="px-4 py-2">{invoice.due_date ?? "—"}</td>
                <td className="px-4 py-2">{invoice.total_amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
