"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Wallet } from "lucide-react";

import { listSupplierPayments, listSuppliers } from "@embroidery/types";
import type { Supplier, SupplierPaymentOut } from "@embroidery/types";

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

export default function SupplierPaymentsPage() {
  const { hasPermission } = useAuth();
  const [payments, setPayments] = useState<SupplierPaymentOut[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPayments(null);
    Promise.all([listSupplierPayments(), listSuppliers()])
      .then(([paymentsData, suppliersData]) => {
        setPayments(paymentsData);
        setSuppliers(suppliersData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view supplier payments.");
        } else {
          setError("Could not load supplier payments.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Supplier Payments</h1>
        {hasPermission("supplier_payments.create") && (
          <Button render={<Link href="/supplier-payments/new" />}>Record Payment</Button>
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

      {!error && payments === null && <PaymentsTableSkeleton />}

      {!error && payments !== null && payments.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Wallet className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No supplier payments yet</p>
          <p className="text-sm text-muted-foreground">Payments you record will show up here.</p>
        </div>
      )}

      {!error && payments !== null && payments.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Link
                      href={`/supplier-payments/${payment.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {payment.payment_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{supplierName(payment.supplier_id)}</TableCell>
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

function PaymentsTableSkeleton() {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Payment #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
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
  );
}
