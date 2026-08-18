"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { getProductionSummaryReport, listBranches } from "@embroidery/types";
import type { BranchOut, ProductionSummaryReportOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { CategoricalBarChart } from "@/components/CategoricalBarChart";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ProductionSummaryReportPage() {
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState("");

  const [report, setReport] = useState<ProductionSummaryReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const load = useCallback(() => {
    setError(null);
    setReport(null);
    getProductionSummaryReport({ date_from: dateFrom, date_to: dateTo, branch_id: branchId || undefined })
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reports.");
        } else if (err instanceof ApiError && err.status === 400) {
          setError("The 'from' date must be before the 'to' date.");
        } else {
          setError("Could not load the production summary.");
        }
      });
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Production Summary</h1>
        <p className="text-sm text-muted-foreground">Approved production quantity for the period, by component and by lot.</p>
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
          <Skeleton className="h-20 w-full max-w-xs rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}

      {!error && report !== null && (
        <>
          <Card className="max-w-xs">
            <CardContent>
              <p className="text-sm text-muted-foreground">Total quantity produced</p>
              <p className="text-lg font-semibold tabular-nums">{report.total_quantity.toLocaleString()}</p>
            </CardContent>
          </Card>

          {report.by_component.length > 0 && (
            <CategoricalBarChart
              data={report.by_component.map((row) => ({
                label: row.component_type.charAt(0).toUpperCase() + row.component_type.slice(1),
                value: row.quantity,
              }))}
            />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-semibold">By component</h2>
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.by_component.map((row) => (
                      <TableRow key={row.component_type}>
                        <TableCell className="capitalize">{row.component_type}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                      </TableRow>
                    ))}
                    {report.by_component.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No approved production in this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold">By lot</h2>
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.by_lot.map((row) => (
                      <TableRow key={row.lot_id}>
                        <TableCell>
                          <Link href={`/lots/${row.lot_id}`} className="font-medium text-foreground hover:underline">
                            {row.lot_number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                      </TableRow>
                    ))}
                    {report.by_lot.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No approved production in this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
