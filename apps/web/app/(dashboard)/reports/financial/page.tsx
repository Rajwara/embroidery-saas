"use client";

import { useCallback, useEffect, useState } from "react";

import { AlertCircle } from "lucide-react";

import { getFinancialSummaryReport, listBranches } from "@embroidery/types";
import type { BranchOut, FinancialSummaryReportOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { FinancialSummaryChart } from "@/components/FinancialSummaryChart";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FinancialSummaryReportPage() {
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState("");

  const [report, setReport] = useState<FinancialSummaryReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const load = useCallback(() => {
    setError(null);
    setReport(null);
    getFinancialSummaryReport({ date_from: dateFrom, date_to: dateTo, branch_id: branchId || undefined })
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reports.");
        } else if (err instanceof ApiError && err.status === 400) {
          setError("The 'from' date must be before the 'to' date.");
        } else {
          setError("Could not load the financial summary.");
        }
      });
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Financial Summary</h1>
        <p className="text-sm text-muted-foreground">Invoiced revenue vs. expenses and purchases for the period.</p>
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
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full max-w-md rounded-xl" />
        </div>
      )}

      {!error && report !== null && (
        <div className="space-y-4">
          <FinancialSummaryChart revenue={report.revenue} expenses={report.expenses} purchases={report.purchases} />

          <div className="w-full max-w-md rounded-xl border">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Revenue (invoiced)</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{report.revenue.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Expenses</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-destructive">
                    -{report.expenses.toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Purchases</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-destructive">
                    -{report.purchases.toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">Net</TableCell>
                  <TableCell
                    className={`text-right text-base font-bold tabular-nums ${report.net < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}`}
                  >
                    {report.net.toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
