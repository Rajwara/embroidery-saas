"use client";

import { useCallback, useEffect, useState, use } from "react";

import { AlertCircle } from "lucide-react";

import { getPurchase, listSuppliers } from "@embroidery/types";
import type { PurchaseDetailOut, Supplier } from "@embroidery/types";

import { ApiError } from "@/lib/api";
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

export default function PurchaseDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [purchase, setPurchase] = useState<PurchaseDetailOut | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPurchase(null);
    Promise.all([getPurchase(params.id), listSuppliers()])
      .then(([purchaseData, suppliers]: [PurchaseDetailOut, Supplier[]]) => {
        setPurchase(purchaseData);
        setSupplierName(suppliers.find((s) => s.id === purchaseData.supplier_id)?.name ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Purchase not found.");
        } else {
          setError("Could not load purchase.");
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

  if (purchase === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{purchase.purchase_number}</h1>
        <p className="text-sm text-muted-foreground">
          {supplierName ?? "—"} &middot; {purchase.purchase_date}
          {purchase.due_date && <> &middot; due {purchase.due_date}</>}
        </p>
        {purchase.notes && <p className="mt-1 text-sm text-muted-foreground">{purchase.notes}</p>}
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchase.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.description}</TableCell>
                <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{line.unit_price.toFixed(2)}</TableCell>
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
                {purchase.total_amount.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
