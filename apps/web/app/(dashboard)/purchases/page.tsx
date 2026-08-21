"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ShoppingCart } from "lucide-react";

import { listPurchases, listSuppliers } from "@embroidery/types";
import type { PurchaseOut, Supplier } from "@embroidery/types";

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

export default function PurchasesPage() {
  const { hasPermission } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseOut[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPurchases(null);
    Promise.all([listPurchases(), listSuppliers()])
      .then(([purchasesData, suppliersData]) => {
        setPurchases(purchasesData);
        setSuppliers(suppliersData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view purchases.");
        } else {
          setError("Could not load purchases.");
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
        <h1 className="text-2xl font-semibold">Purchases</h1>
        {hasPermission("purchases.create") && (
          <Button render={<Link href="/purchases/new" />}>New Purchase</Button>
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

      {!error && purchases === null && <PurchasesTableSkeleton />}

      {!error && purchases !== null && purchases.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <ShoppingCart className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No purchases yet</p>
          <p className="text-sm text-muted-foreground">Purchases you record will show up here.</p>
        </div>
      )}

      {!error && purchases !== null && purchases.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purchase #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>
                    <Link href={`/purchases/${purchase.id}`} className="font-medium text-foreground hover:underline">
                      {purchase.purchase_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{supplierName(purchase.supplier_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{purchase.purchase_date}</TableCell>
                  <TableCell className="text-muted-foreground">{purchase.due_date ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{purchase.total_amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PurchasesTableSkeleton() {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Purchase #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Total</TableHead>
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
                <Skeleton className="h-4 w-20" />
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
