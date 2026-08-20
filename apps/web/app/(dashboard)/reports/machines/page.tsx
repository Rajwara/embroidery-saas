"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

import { getMachineCostReport, listBranches } from "@embroidery/types";
import type { BranchOut, MachineCostReportOut } from "@embroidery/types";

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

export default function MachineCostReportPage() {
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState("");

  const [report, setReport] = useState<MachineCostReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const load = useCallback(() => {
    setError(null);
    setReport(null);
    getMachineCostReport({ date_from: dateFrom, date_to: dateTo, branch_id: branchId || undefined })
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reports.");
        } else if (err instanceof ApiError && err.status === 400) {
          setError("The 'from' date must be before the 'to' date.");
        } else {
          setError("Could not load the machine cost report.");
        }
      });
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Machine Cost Report</h1>
        <p className="text-sm text-muted-foreground">
          Overhead expenses for the period are split equally across active machines in scope.
          Revenue and profit aren&apos;t computed yet -- see the report notes below.
        </p>
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
          <Skeleton className="h-20 w-full max-w-md rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}

      {!error && report !== null && (
        <>
          <Card className="max-w-md">
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">
                  Total overhead ({report.branch_id ? branchName(report.branch_id) : "all branches"})
                </p>
                <p className="text-lg font-semibold tabular-nums">{report.total_overhead.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Active machines</p>
                <p className="text-lg font-semibold tabular-nums">{report.active_machine_count}</p>
              </div>
            </CardContent>
          </Card>

          {report.machines.length > 0 && (
            <CategoricalBarChart
              data={report.machines.map((m) => ({
                label: m.machine_name ?? m.machine_code,
                value: m.overhead_share,
              }))}
              valueFormatter={(v) => v.toFixed(2)}
            />
          )}

          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead className="text-right">Stitches produced</TableHead>
                  <TableHead className="text-right">Quantity produced</TableHead>
                  <TableHead className="text-right">Overhead share</TableHead>
                  <TableHead className="text-right">Cost per stitch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.machines.map((machine) => (
                  <TableRow key={machine.machine_id}>
                    <TableCell className="font-medium">{machine.machine_name ?? machine.machine_code}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {machine.total_stitches > 0 ? machine.total_stitches.toLocaleString() : "—"}
                      {machine.quantity_missing_stitch_count > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({machine.quantity_missing_stitch_count} unset)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{machine.quantity_produced}</TableCell>
                    <TableCell className="text-right tabular-nums">{machine.overhead_share.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {machine.cost_per_stitch === null ? "—" : machine.cost_per_stitch.toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
                {report.machines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No active machines in scope.
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
