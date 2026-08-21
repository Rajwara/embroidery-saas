"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { AlertCircle, FileText } from "lucide-react";

import { getInvoiceBalances, getParty, listInvoices } from "@embroidery/types";
import type { InvoiceBalanceOut, InvoiceOut, PartyDocsOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InvoiceStatus = "paid" | "overdue" | "pending";

function invoiceStatus(invoice: InvoiceOut, balance: number): InvoiceStatus {
  if (balance <= 0.005) return "paid";
  const today = new Date().toISOString().slice(0, 10);
  if (invoice.due_date && invoice.due_date < today) return "overdue";
  return "pending";
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  if (status === "paid") return <Badge variant="success">Paid</Badge>;
  if (status === "overdue") return <Badge variant="destructive">Overdue</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export default function PartyInvoicesPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { hasPermission } = useAuth();
  const [party, setParty] = useState<PartyDocsOut | null>(null);
  const [invoices, setInvoices] = useState<InvoiceOut[] | null>(null);
  const [balances, setBalances] = useState<InvoiceBalanceOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setParty(null);
    setInvoices(null);
    Promise.all([
      getParty(params.id),
      listInvoices({ party_id: params.id, limit: 200 }),
      getInvoiceBalances({ party_id: params.id }),
    ])
      .then(([partyData, invoicesData, balancesData]) => {
        setParty(partyData);
        setInvoices(invoicesData);
        setBalances(balancesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Party not found.");
        } else if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view this company's invoices.");
        } else {
          setError("Could not load invoices.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

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

  if (party === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{party.name}</h1>
          <p className="text-sm text-muted-foreground">Invoices for this company</p>
        </div>
        {hasPermission("invoices.create") && (
          <Button render={<Link href={`/invoices/new?party_id=${party.id}`} />}>New Invoice</Button>
        )}
      </div>

      {invoices === null && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {invoices !== null && invoices.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No invoices yet</p>
          <p className="text-sm text-muted-foreground">Invoices for {party.name} will show up here.</p>
        </div>
      )}

      {invoices !== null && invoices.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const balance = balances.find((b) => b.invoice_id === invoice.id)?.balance ?? invoice.total_amount;
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link href={`/invoices/${invoice.id}`} className="font-medium text-foreground hover:underline">
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{invoice.invoice_date}</TableCell>
                    <TableCell className="text-muted-foreground">{invoice.due_date ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoiceStatus(invoice, balance)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{invoice.total_amount.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
