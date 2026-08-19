"use client";

import { useCallback, useEffect, useState, use } from "react";

import { AlertCircle } from "lucide-react";

import { getSupplierPayment, listSuppliers } from "@embroidery/types";
import type { Supplier, SupplierPaymentDetailOut } from "@embroidery/types";

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

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

const ALLOCATION_TYPE_LABELS: Record<string, string> = {
  purchase: "Purchase",
  general: "General (against balance)",
  advance: "Advance",
  unallocated: "Unallocated",
};

export default function SupplierPaymentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [payment, setPayment] = useState<SupplierPaymentDetailOut | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPayment(null);
    Promise.all([getSupplierPayment(params.id), listSuppliers()])
      .then(([paymentData, suppliers]: [SupplierPaymentDetailOut, Supplier[]]) => {
        setPayment(paymentData);
        setSupplierName(suppliers.find((s) => s.id === paymentData.supplier_id)?.name ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Payment not found.");
        } else {
          setError("Could not load payment.");
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

  if (payment === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{payment.payment_number}</h1>
        <p className="text-sm text-muted-foreground">
          {supplierName ?? "—"} &middot; {payment.payment_date} &middot;{" "}
          {METHOD_LABELS[payment.payment_method] ?? payment.payment_method} &middot; {payment.amount.toFixed(2)}
        </p>
        {payment.notes && <p className="mt-1 text-sm text-muted-foreground">{payment.notes}</p>}
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Purchase</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payment.allocations.map((allocation) => (
              <TableRow key={allocation.id}>
                <TableCell>
                  <Badge variant={allocation.allocation_type === "purchase" ? "default" : "secondary"}>
                    {ALLOCATION_TYPE_LABELS[allocation.allocation_type] ?? allocation.allocation_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{allocation.purchase_number ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{allocation.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
