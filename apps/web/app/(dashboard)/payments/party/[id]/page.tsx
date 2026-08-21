"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { AlertCircle, Wallet } from "lucide-react";

import { getParty, listPayments } from "@embroidery/types";
import type { PartyDocsOut, PaymentOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

export default function PartyPaymentsPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { hasPermission } = useAuth();
  const [party, setParty] = useState<PartyDocsOut | null>(null);
  const [payments, setPayments] = useState<PaymentOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setParty(null);
    setPayments(null);
    Promise.all([getParty(params.id), listPayments({ party_id: params.id, limit: 200 })])
      .then(([partyData, paymentsData]) => {
        setParty(partyData);
        setPayments(paymentsData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Party not found.");
        } else if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view this company's payments.");
        } else {
          setError("Could not load payments.");
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
          <p className="text-sm text-muted-foreground">Payments received from this company</p>
        </div>
        {hasPermission("payments.create") && (
          <Button render={<Link href={`/payments/new?party_id=${party.id}`} />}>New Payment</Button>
        )}
      </div>

      {payments === null && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
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
                    <Skeleton className="h-4 w-24" />
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

      {payments !== null && payments.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Wallet className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No payments yet</p>
          <p className="text-sm text-muted-foreground">Payments from {party.name} will show up here.</p>
        </div>
      )}

      {payments !== null && payments.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Link href={`/payments/${payment.id}`} className="font-medium text-foreground hover:underline">
                      {payment.payment_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{payment.payment_date}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {METHOD_LABELS[payment.payment_method] ?? payment.payment_method}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{payment.amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
