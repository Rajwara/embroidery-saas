"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Wallet } from "lucide-react";

import { listPayments, listParties } from "@embroidery/types";
import type { Party, PaymentOut } from "@embroidery/types";

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

interface CompanyRow {
  party: Party;
  count: number;
  total: number;
}

export default function PaymentsPage() {
  const { hasPermission } = useAuth();
  const [payments, setPayments] = useState<PaymentOut[] | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPayments(null);
    Promise.all([listPayments({ limit: 200 }), listParties()])
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

  const rows: CompanyRow[] = (() => {
    if (!payments) return [];
    const byParty = new Map<string, { count: number; total: number }>();
    for (const payment of payments) {
      const entry = byParty.get(payment.party_id) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += payment.amount;
      byParty.set(payment.party_id, entry);
    }
    return Array.from(byParty.entries())
      .map(([partyId, agg]) => {
        const party = parties.find((p) => p.id === partyId);
        return party ? { party, ...agg } : null;
      })
      .filter((row): row is CompanyRow => row !== null)
      .sort((a, b) => a.party.name.localeCompare(b.party.name));
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Party Payments</h1>
        {hasPermission("payments.create") && (
          <Button render={<Link href="/payments/new" />}>New Payment</Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{error}</AlertTitle>
          <AlertDescription>
            <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={load}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!error && payments === null && <CompanyTableSkeleton />}

      {!error && payments !== null && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Wallet className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No payments yet</p>
          <p className="text-sm text-muted-foreground">Payments you record will show up here, grouped by company.</p>
        </div>
      )}

      {!error && payments !== null && rows.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Total Payments</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ party, count, total }) => (
                <TableRow key={party.id}>
                  <TableCell>
                    <Link href={`/payments/party/${party.id}`} className="font-medium text-foreground hover:underline">
                      {party.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{count}</TableCell>
                  <TableCell className="text-right tabular-nums">{total.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CompanyTableSkeleton() {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead className="text-right">Total Payments</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-10" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
