"use client";

import { useCallback, useEffect, useState } from "react";

import { getInvoice, listParties } from "@embroidery/types";
import type { InvoiceDetailOut, Party } from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";

const PRICING_LABELS: Record<string, string> = {
  per_suit: "Per suit",
  stitch_based: "Stitch-based",
};

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<InvoiceDetailOut | null>(null);
  const [partyName, setPartyName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setInvoice(null);
    Promise.all([getInvoice(params.id), listParties()])
      .then(([invoiceData, parties]) => {
        setInvoice(invoiceData);
        setPartyName(parties.find((p) => p.id === invoiceData.party_id)?.name ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Invoice not found.");
        } else {
          setError("Could not load invoice.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = async () => {
    if (!invoice) return;
    setPrintError(null);
    setPrinting(true);
    try {
      const blob = await fetchPdfBlob(`/invoices/${invoice.id}/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setPrintError("Could not generate the PDF. Please try again.");
    } finally {
      setPrinting(false);
    }
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

  if (invoice === null) {
    return <p className="text-sm text-gray-500">Loading invoice...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{invoice.invoice_number}</h1>
          <p className="text-sm text-gray-500">
            {partyName ?? "—"} &middot; {invoice.invoice_date}
            {invoice.due_date && <> &middot; due {invoice.due_date}</>}
          </p>
          {invoice.notes && <p className="mt-1 text-sm text-gray-500">{invoice.notes}</p>}
        </div>
        <div className="text-right">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {printing ? "Generating..." : "Print"}
          </button>
          {printError && <p className="mt-1 text-xs text-red-600">{printError}</p>}
        </div>
      </div>

      <table className="w-full rounded bg-white text-sm shadow">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="px-4 py-2 font-medium">Pricing</th>
            <th className="px-4 py-2 font-medium">Qty</th>
            <th className="px-4 py-2 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2">{line.description}</td>
              <td className="px-4 py-2">{PRICING_LABELS[line.pricing_type] ?? line.pricing_type}</td>
              <td className="px-4 py-2">{line.quantity}</td>
              <td className="px-4 py-2">{line.line_total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="px-4 py-2 text-right font-semibold">
              Total
            </td>
            <td className="px-4 py-2 font-semibold">{invoice.total_amount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
