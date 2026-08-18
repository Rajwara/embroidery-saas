"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";

import { getInventoryMovementReport, listBranches } from "@embroidery/types";
import type { BranchOut, InventoryMovementReportOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
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
import { CategoricalBarChart } from "@/components/CategoricalBarChart";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InventoryMovementReportPage() {
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState("");

  const [report, setReport] = useState<InventoryMovementReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const load = useCallback(() => {
    setError(null);
    setReport(null);
    getInventoryMovementReport({ date_from: dateFrom, date_to: dateTo, branch_id: branchId || undefined })
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reports.");
        } else if (err instanceof ApiError && err.status === 400) {
          setError("The 'from' date must be before the 'to' date.");
        } else {
          setError("Could not load the inventory movement report.");
        }
      });
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  // Aggregate across items for a single "where did movement go this period"
  // comparison -- the report itself is naturally a per-item ledger, not
  // something with its own summary endpoint, so this is a client-side
  // reduction over data already fetched, not a new backend call.
  const movementTotals = useMemo(() => {
    if (!report) return null;
    return report.items.reduce(
      (acc, item) => ({
        receipts: acc.receipts + item.receipts,
        issues: acc.issues + Math.abs(item.issues),
        adjustments: acc.adjustments + Math.abs(item.adjustments),
      }),
      { receipts: 0, issues: 0, adjustments: 0 }
    );
  }, [report]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Inventory Movement</h1>
        <p className="text-sm text-muted-foreground">Opening stock, receipts, issues, and adjustments for the period.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
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

      {!error && report === null && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}

      {!error && report !== null && movementTotals && (
        <>
          {report.items.length > 0 && (
            <CategoricalBarChart
              data={[
                { label: "Receipts", value: movementTotals.receipts },
                { label: "Issued", value: movementTotals.issues },
                { label: "Adjustments", value: movementTotals.adjustments },
              ]}
            />
          )}

          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Receipts</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead className="text-right">Adjustments</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.map((item) => (
                  <TableRow key={item.inventory_item_id}>
                    <TableCell>
                      {item.item_name} <span className="text-muted-foreground">({item.unit})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.opening_stock}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.receipts}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.abs(item.issues)}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.adjustments}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{item.closing_stock}</TableCell>
                  </TableRow>
                ))}
                {report.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No active inventory items in scope.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
