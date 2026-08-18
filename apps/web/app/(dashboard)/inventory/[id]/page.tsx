"use client";

import { useCallback, useEffect, useState, use } from "react";

import { AlertCircle, History } from "lucide-react";

import { getInventoryItem, listStockTransactions } from "@embroidery/types";
import type { InventoryItemOut, StockTransactionOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
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

import { AddTransactionForm } from "./_components/AddTransactionForm";

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  receipt: "Receipt",
  issue: "Issue",
  adjustment: "Adjustment",
};

export default function InventoryItemDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [item, setItem] = useState<InventoryItemOut | null>(null);
  const [transactions, setTransactions] = useState<StockTransactionOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setItem(null);
    setTransactions(null);
    Promise.all([getInventoryItem(params.id), listStockTransactions(params.id)])
      .then(([itemData, transactionsData]) => {
        setItem(itemData);
        setTransactions(transactionsData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Inventory item not found.");
        } else {
          setError("Could not load inventory item.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTransactionCreated = (transaction: StockTransactionOut) => {
    setTransactions((prev) => (prev ? [transaction, ...prev] : [transaction]));
    getInventoryItem(params.id).then(setItem);
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

  if (item === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{item.name}</h1>
          <p className="text-sm text-muted-foreground">
            {item.category ?? "—"} &middot; unit: {item.unit}
          </p>
          {item.notes && <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>}
        </div>
        <div className="text-right">
          {item.is_below_threshold ? (
            <Badge variant="warning" className="h-auto px-2 py-1 text-base font-semibold">
              {item.current_stock} {item.unit}
            </Badge>
          ) : (
            <div className="text-2xl font-semibold tabular-nums">
              {item.current_stock} {item.unit}
            </div>
          )}
          <div className="text-xs text-muted-foreground">threshold: {item.minimum_threshold}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Transaction history</h2>
          {transactions === null && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}
          {transactions !== null && transactions.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
              <History className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            </div>
          )}
          {transactions !== null && transactions.length > 0 && (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground">{t.transaction_date}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {TRANSACTION_TYPE_LABELS[t.transaction_type] ?? t.transaction_type}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${t.quantity < 0 ? "text-destructive" : "text-emerald-700"}`}
                      >
                        {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <AddTransactionForm item={item} onCreated={handleTransactionCreated} />
      </div>
    </div>
  );
}
