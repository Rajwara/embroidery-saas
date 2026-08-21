"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, FileText } from "lucide-react";

import { listParties } from "@embroidery/types";
import type { Party } from "@embroidery/types";

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

interface CompanyRow {
  party: Party;
  totalCount: number;
}

export default function InvoicesPage() {
  const { hasPermission } = useAuth();
  const [parties, setParties] = useState<Party[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSeeMoney = hasPermission("parties.see_money");

  const load = useCallback(() => {
    setError(null);
    setParties(null);
    listParties()
      .then(setParties)
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

  const rows: CompanyRow[] = (parties ?? [])
    .map((party) => ({
      party,
      totalCount:
        (party.paid_invoices_count ?? 0) + (party.pending_invoices_count ?? 0) + (party.overdue_invoices_count ?? 0),
    }))
    .filter((row) => row.totalCount > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        {hasPermission("invoices.create") && (
          <Button render={<Link href="/invoices/new" />}>New Invoice</Button>
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

      {!error && parties === null && <CompanyTableSkeleton canSeeMoney={canSeeMoney} />}

      {!error && parties !== null && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No invoices yet</p>
          <p className="text-sm text-muted-foreground">Invoices you create will show up here, grouped by company.</p>
        </div>
      )}

      {!error && parties !== null && rows.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Total Invoices</TableHead>
                {canSeeMoney && <TableHead className="text-right">Total Amount</TableHead>}
                {canSeeMoney && <TableHead className="text-right">Pending Amount</TableHead>}
                {canSeeMoney && <TableHead className="text-right">Overdue Amount</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ party, totalCount }) => {
                const overdue = party.overdue_invoices_amount ?? 0;
                return (
                  <TableRow key={party.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/party/${party.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {party.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{totalCount}</TableCell>
                    {canSeeMoney && (
                      <TableCell className="text-right tabular-nums">
                        {(party.total_invoiced_amount ?? 0).toFixed(2)}
                      </TableCell>
                    )}
                    {canSeeMoney && (
                      <TableCell className="text-right tabular-nums">
                        {(party.pending_invoices_amount ?? 0).toFixed(2)}
                      </TableCell>
                    )}
                    {canSeeMoney && (
                      <TableCell className="text-right">
                        {overdue > 0.005 ? (
                          <Badge variant="destructive">{overdue.toFixed(2)}</Badge>
                        ) : (
                          <span className="tabular-nums text-muted-foreground">{overdue.toFixed(2)}</span>
                        )}
                      </TableCell>
                    )}
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

function CompanyTableSkeleton({ canSeeMoney }: { canSeeMoney: boolean }) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead className="text-right">Total Invoices</TableHead>
            {canSeeMoney && <TableHead className="text-right">Total Amount</TableHead>}
            {canSeeMoney && <TableHead className="text-right">Pending Amount</TableHead>}
            {canSeeMoney && <TableHead className="text-right">Overdue Amount</TableHead>}
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
              {canSeeMoney && (
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
              )}
              {canSeeMoney && (
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
              )}
              {canSeeMoney && (
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
