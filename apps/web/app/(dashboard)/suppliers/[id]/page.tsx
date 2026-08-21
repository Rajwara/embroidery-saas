"use client";

import { useCallback, useEffect, useState, use } from "react";

import Link from "next/link";
import { AlertCircle, Loader2, Printer, Receipt } from "lucide-react";

import { getPurchaseBalances, getSupplier, getSupplierLedger, listPurchases } from "@embroidery/types";
import type {
  PurchaseBalanceOut,
  PurchaseOut,
  SupplierDocsOut,
  SupplierLedgerEntryOut,
} from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ENTRY_TYPE_LABELS: Record<string, string> = {
  opening_balance: "Opening Balance",
  purchase: "Purchase",
};

const ENTRY_TYPE_BADGE_VARIANT: Record<string, "default" | "secondary" | "success"> = {
  opening_balance: "secondary",
  purchase: "default",
};

export default function SupplierDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { hasPermission } = useAuth();
  const canSeeMoney = hasPermission("suppliers.see_money");

  const [supplier, setSupplier] = useState<SupplierDocsOut | null>(null);
  const [ledger, setLedger] = useState<SupplierLedgerEntryOut[] | null>(null);
  const [purchases, setPurchases] = useState<PurchaseOut[] | null>(null);
  const [balances, setBalances] = useState<PurchaseBalanceOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setSupplier(null);
    setLedger(null);
    setPurchases(null);
    setBalances(null);
    Promise.all([
      getSupplier(params.id),
      canSeeMoney ? getSupplierLedger(params.id) : Promise.resolve(null),
      canSeeMoney ? listPurchases({ supplier_id: params.id, limit: 200 }) : Promise.resolve(null),
      canSeeMoney ? getPurchaseBalances({ supplier_id: params.id }) : Promise.resolve(null),
    ])
      .then(([supplierData, ledgerData, purchasesData, balancesData]) => {
        setSupplier(supplierData);
        setLedger(ledgerData);
        setPurchases(purchasesData);
        setBalances(balancesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Supplier not found.");
        } else {
          setError("Could not load supplier.");
        }
      });
  }, [params.id, canSeeMoney]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = async () => {
    setPrintError(null);
    setPrinting(true);
    try {
      const blob = await fetchPdfBlob(`/suppliers/${params.id}/ledger/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setPrintError("Could not generate the statement. Please try again.");
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

  if (supplier === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{supplier.name}</h1>
          <p className="text-sm text-muted-foreground">
            {supplier.contact_person ?? "—"} &middot; {supplier.phone ?? "—"} &middot; {supplier.email ?? "—"}
          </p>
          {supplier.address && <p className="mt-1 text-sm text-muted-foreground">{supplier.address}</p>}
        </div>
        {canSeeMoney && (
          <div className="text-right">
            <Button onClick={handlePrint} disabled={printing}>
              {printing ? <Loader2 className="animate-spin" /> : <Printer />}
              {printing ? "Generating..." : "Print statement"}
            </Button>
            {printError && <p className="mt-1 text-xs text-destructive">{printError}</p>}
          </div>
        )}
      </div>

      {canSeeMoney && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Purchases</h2>
          {purchases === null && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {purchases !== null && purchases.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border py-12 text-center">
              <Receipt className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No purchases yet</p>
            </div>
          )}

          {purchases !== null && purchases.length > 0 && (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => {
                    const balanceRow = balances?.find((b) => b.purchase_id === purchase.id);
                    const pending = balanceRow ? balanceRow.balance : undefined;
                    const isPaid = pending !== undefined && pending <= 0.005;
                    const isOverdue =
                      pending !== undefined &&
                      pending > 0.005 &&
                      !!purchase.due_date &&
                      purchase.due_date < new Date().toISOString().slice(0, 10);
                    return (
                      <TableRow key={purchase.id}>
                        <TableCell>
                          <Link href={`/purchases/${purchase.id}`} className="font-medium hover:underline">
                            {purchase.purchase_number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{purchase.purchase_date}</TableCell>
                        <TableCell className="text-muted-foreground">{purchase.due_date ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{purchase.total_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {balanceRow ? balanceRow.paid_amount.toFixed(2) : <Skeleton className="ml-auto h-4 w-14" />}
                        </TableCell>
                        <TableCell className="text-right">
                          {pending === undefined ? (
                            <Skeleton className="ml-auto h-4 w-14" />
                          ) : (
                            <Badge variant={isPaid ? "success" : isOverdue ? "destructive" : "warning"}>
                              {pending.toFixed(2)}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}

      {canSeeMoney && (
        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {ledger === null && <LedgerSkeleton />}

            {ledger !== null && ledger.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Receipt className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">No transactions yet</p>
                <p className="text-sm text-muted-foreground">Purchases will show up here.</p>
              </div>
            )}

            {ledger !== null && ledger.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Billed Amount</TableHead>
                    <TableHead className="text-right">Paid Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{entry.entry_date}</TableCell>
                      <TableCell>
                        <Badge variant={ENTRY_TYPE_BADGE_VARIANT[entry.entry_type] ?? "secondary"}>
                          {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.reference}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.debit ? entry.debit.toFixed(2) : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.credit ? entry.credit.toFixed(2) : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {entry.balance.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LedgerSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
