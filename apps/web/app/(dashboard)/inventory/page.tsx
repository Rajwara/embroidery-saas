"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, Boxes, Package } from "lucide-react";

import { listInventoryItems } from "@embroidery/types";
import type { InventoryItemOut } from "@embroidery/types";

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

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<InventoryItemOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setItems(null);
    listInventoryItems()
      .then(setItems)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view inventory.");
        } else {
          setError("Could not load inventory.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lowStockCount = items?.filter((i) => i.is_below_threshold).length ?? 0;
  const visibleItems = items?.filter((i) => !showLowStockOnly || i.is_below_threshold) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        {hasPermission("inventory.create") && (
          <Button render={<Link href="/inventory/new" />}>New Item</Button>
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

      {!error && items === null && (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      )}

      {!error && items !== null && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total items</p>
                <p className="text-2xl font-semibold tabular-nums">{items.length}</p>
              </div>
              <Boxes className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <button onClick={() => setShowLowStockOnly((v) => !v)} className="text-left">
            <Card
              className={lowStockCount > 0 ? "ring-1 ring-inset ring-amber-600/30" : undefined}
            >
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Below threshold {showLowStockOnly ? "(showing)" : ""}
                  </p>
                  <p className={`text-2xl font-semibold tabular-nums ${lowStockCount > 0 ? "text-amber-700" : ""}`}>
                    {lowStockCount}
                  </p>
                </div>
                <AlertTriangle className={`size-5 ${lowStockCount > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      {!error && items !== null && visibleItems.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Package className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No inventory items</p>
          <p className="text-sm text-muted-foreground">
            {showLowStockOnly ? "Nothing is below threshold." : "Items you add will show up here."}
          </p>
        </div>
      )}

      {!error && items !== null && visibleItems.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link href={`/inventory/${item.id}`} className="font-medium text-foreground hover:underline">
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.category ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.is_below_threshold ? (
                      <Badge variant="warning">{item.current_stock}</Badge>
                    ) : (
                      item.current_stock
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.minimum_threshold}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
