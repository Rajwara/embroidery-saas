"use client";

import { useCallback, useEffect, useState, use } from "react";

import { AlertCircle, Loader2, Printer } from "lucide-react";

import { getInvoice, listParties } from "@embroidery/types";
import type { InvoiceDetailOut } from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PRICING_LABELS: Record<string, string> = {
  per_suit: "Per suit",
  stitch_based: "Stitch-based",
};

export default function InvoiceDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
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
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{error}</AlertTitle>
        <AlertDescription>
          <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={load}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (invoice === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{invoice.invoice_number}</h1>
          <p className="text-sm text-muted-foreground">
            {partyName ?? "—"} &middot; {invoice.invoice_date}
            {invoice.due_date && <> &middot; due {invoice.due_date}</>}
            {invoice.promised_payment_date && <> &middot; promised {invoice.promised_payment_date}</>}
          </p>
          {invoice.notes && <p className="mt-1 text-sm text-muted-foreground">{invoice.notes}</p>}
        </div>
        <div className="text-right">
          <Button onClick={handlePrint} disabled={printing}>
            {printing ? <Loader2 className="animate-spin" /> : <Printer />}
            {printing ? "Generating..." : "Print"}
          </Button>
          {printError && <p className="mt-1 text-xs text-destructive">{printError}</p>}
        </div>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Pricing</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.description}</TableCell>
                <TableCell className="text-muted-foreground">
                  {PRICING_LABELS[line.pricing_type] ?? line.pricing_type}
                </TableCell>
                <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{line.line_total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="text-right font-semibold">
                Total
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {invoice.total_amount.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
