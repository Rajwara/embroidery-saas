"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { AlertCircle, Banknote, Clock, Landmark, Package, Timer, Users, Wallet, X } from "lucide-react";

import { listLots, listParties } from "@embroidery/types";
import type { LotOut, Party } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RowFilter = "pending" | "cheque" | null;

export default function PartiesPage() {
  const { hasPermission } = useAuth();
  const [parties, setParties] = useState<Party[] | null>(null);
  const [lots, setLots] = useState<LotOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowFilter, setRowFilter] = useState<RowFilter>(null);

  const canSeeMoney = hasPermission("parties.see_money");
  const canViewLots = hasPermission("lots.view");

  const load = useCallback(() => {
    setError(null);
    setParties(null);
    setLots(null);
    Promise.all([
      listParties(),
      canViewLots ? listLots({ limit: 200 }) : Promise.resolve(null),
    ])
      .then(([partiesData, lotsData]) => {
        setParties(partiesData);
        setLots(lotsData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view parties.");
        } else {
          setError("Could not load parties.");
        }
      });
  }, [canViewLots]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFilter = (next: RowFilter) => {
    setRowFilter((current) => (current === next ? null : next));
  };

  const totalInvoicedAmount = (parties ?? []).reduce((sum, p) => sum + (p.total_invoiced_amount ?? 0), 0);
  const totalReceivedAmount = (parties ?? []).reduce((sum, p) => sum + (p.total_received_amount ?? 0), 0);
  const totalPendingAmount = (parties ?? []).reduce(
    (sum, p) => sum + (p.pending_invoices_amount ?? 0) + (p.overdue_invoices_amount ?? 0),
    0
  );
  const promisedChequeAmount = (parties ?? []).reduce((sum, p) => sum + (p.promised_cheque_amount ?? 0), 0);
  const activeLotsCount = (lots ?? []).filter((l) => l.status === "confirmed").length;
  const pendingLotsCount = (lots ?? []).filter(
    (l) => l.status === "pending_breakdown" || l.status === "pending_confirmation"
  ).length;

  const isPending = (p: Party) => (p.pending_invoices_amount ?? 0) + (p.overdue_invoices_amount ?? 0) > 0.005;
  const isChequePromised = (p: Party) => (p.promised_cheque_amount ?? 0) > 0.005;

  const visibleParties = (parties ?? []).filter((p) => {
    if (rowFilter === "pending") return isPending(p);
    if (rowFilter === "cheque") return isChequePromised(p);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Parties</h1>
        {hasPermission("parties.create") && <Button render={<Link href="/parties/new" />}>Add Party</Button>}
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

      {!error && (canSeeMoney || canViewLots) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {canSeeMoney && (
            <SummaryTile
              label="Total Amount"
              value={parties === null ? undefined : totalInvoicedAmount}
              icon={<Wallet />}
              href="/invoices"
            />
          )}
          {canSeeMoney && (
            <SummaryTile
              label="Received Amount"
              value={parties === null ? undefined : totalReceivedAmount}
              icon={<Banknote className="text-brand-green" />}
              valueClassName="text-brand-green-text"
              href="/payments"
            />
          )}
          {canSeeMoney && (
            <SummaryTile
              label="Pending Amount"
              value={parties === null ? undefined : totalPendingAmount}
              icon={<Clock className="text-brand-yellow" />}
              valueClassName={totalPendingAmount > 0 ? "text-brand-yellow-text" : undefined}
              active={rowFilter === "pending"}
              onClick={() => toggleFilter("pending")}
            />
          )}
          {canSeeMoney && (
            <SummaryTile
              label="Promised Cheque Payments"
              value={parties === null ? undefined : promisedChequeAmount}
              icon={<Landmark className="text-brand-blue" />}
              active={rowFilter === "cheque"}
              onClick={() => toggleFilter("cheque")}
            />
          )}
          {canViewLots && (
            <SummaryTile
              label="Active Lots"
              value={lots === null ? undefined : activeLotsCount}
              icon={<Package />}
              isMoney={false}
              href="/lots"
            />
          )}
          {canViewLots && (
            <SummaryTile
              label="Pending Lots"
              value={lots === null ? undefined : pendingLotsCount}
              icon={<Timer />}
              isMoney={false}
              href="/lots"
            />
          )}
        </div>
      )}

      {rowFilter && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing parties with {rowFilter === "pending" ? "a pending or overdue balance" : "a promised cheque payment"}.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setRowFilter(null)}>
            <X />
            Clear filter
          </Button>
        </div>
      )}

      {!error && parties === null && <PartiesTableSkeleton canSeeMoney={canSeeMoney} />}

      {!error && parties !== null && parties.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No parties yet</p>
          <p className="text-sm text-muted-foreground">Clients you add will show up here.</p>
        </div>
      )}

      {!error && parties !== null && parties.length > 0 && visibleParties.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No parties match this filter</p>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setRowFilter(null)}>
            Clear filter
          </Button>
        </div>
      )}

      {!error && parties !== null && visibleParties.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                {canSeeMoney && <TableHead className="text-right">Balance</TableHead>}
                {canSeeMoney && <TableHead className="text-right">Paid Invoices</TableHead>}
                {canSeeMoney && <TableHead className="text-right">Pending Invoices</TableHead>}
                {canSeeMoney && <TableHead className="text-right">Overdue Invoices</TableHead>}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleParties.map((party) => (
                <TableRow key={party.id}>
                  <TableCell>
                    <Link href={`/parties/${party.id}`} className="font-medium text-foreground hover:underline">
                      {party.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{party.contact_person ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{party.phone ?? "—"}</TableCell>
                  {canSeeMoney && (
                    <TableCell className="text-right tabular-nums">
                      {party.current_balance !== null && party.current_balance !== undefined
                        ? Number(party.current_balance).toFixed(2)
                        : "—"}
                    </TableCell>
                  )}
                  {canSeeMoney && (
                    <InvoiceStatusCell
                      href={`/parties/${party.id}`}
                      variant="success"
                      count={party.paid_invoices_count ?? 0}
                      amount={party.paid_invoices_amount ?? 0}
                    />
                  )}
                  {canSeeMoney && (
                    <InvoiceStatusCell
                      href={`/parties/${party.id}`}
                      variant="warning"
                      count={party.pending_invoices_count ?? 0}
                      amount={party.pending_invoices_amount ?? 0}
                    />
                  )}
                  {canSeeMoney && (
                    <InvoiceStatusCell
                      href={`/parties/${party.id}`}
                      variant="destructive"
                      count={party.overdue_invoices_count ?? 0}
                      amount={party.overdue_invoices_amount ?? 0}
                    />
                  )}
                  <TableCell>
                    <Badge variant={party.is_active ? "success" : "secondary"}>
                      {party.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  href,
  onClick,
  active,
  isMoney = true,
  valueClassName,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  isMoney?: boolean;
  valueClassName?: string;
}) {
  const content = (
    <Card className={active ? "ring-2 ring-inset ring-primary" : undefined}>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {value === undefined ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className={`text-xl font-semibold tabular-nums ${valueClassName ?? ""}`}>
              {isMoney ? value.toFixed(2) : value}
            </p>
          )}
        </div>
        <div className="text-muted-foreground [&>svg]:size-5">{icon}</div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-80">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left transition-opacity hover:opacity-80">
      {content}
    </button>
  );
}

function InvoiceStatusCell({
  href,
  variant,
  count,
  amount,
}: {
  href: string;
  variant: "success" | "warning" | "destructive";
  count: number;
  amount: number;
}) {
  if (count === 0) {
    return <TableCell className="text-right text-muted-foreground">—</TableCell>;
  }
  return (
    <TableCell className="text-right">
      <Link href={href} className="inline-flex flex-col items-end gap-0.5 hover:underline">
        <Badge variant={variant}>{count}</Badge>
        <span className="text-xs tabular-nums text-muted-foreground">{amount.toFixed(2)}</span>
      </Link>
    </TableCell>
  );
}

function PartiesTableSkeleton({ canSeeMoney }: { canSeeMoney: boolean }) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business Name</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Phone</TableHead>
            {canSeeMoney && <TableHead className="text-right">Balance</TableHead>}
            {canSeeMoney && <TableHead className="text-right">Paid Invoices</TableHead>}
            {canSeeMoney && <TableHead className="text-right">Pending Invoices</TableHead>}
            {canSeeMoney && <TableHead className="text-right">Overdue Invoices</TableHead>}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              {canSeeMoney && (
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
              )}
              {canSeeMoney && (
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-12" />
                </TableCell>
              )}
              {canSeeMoney && (
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-12" />
                </TableCell>
              )}
              {canSeeMoney && (
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-12" />
                </TableCell>
              )}
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
