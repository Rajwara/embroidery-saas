"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Banknote } from "lucide-react";

import { listBranches, listPayrollRuns } from "@embroidery/types";
import type { BranchOut, PayrollRunOut } from "@embroidery/types";

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

import { StatusBadge } from "./_components/StatusBadge";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PayrollPage() {
  const { hasPermission } = useAuth();
  const [runs, setRuns] = useState<PayrollRunOut[] | null>(null);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRuns(null);
    Promise.all([listPayrollRuns(), listBranches()])
      .then(([runsData, branchesData]) => {
        setRuns(runsData);
        setBranches(branchesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view payroll.");
        } else {
          setError("Could not load payroll runs.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <div className="flex items-center gap-4">
          <Link href="/payroll/salary-profiles" className="text-sm font-medium text-muted-foreground hover:underline">
            Salary Profiles
          </Link>
          <Link href="/payroll/advances" className="text-sm font-medium text-muted-foreground hover:underline">
            Advances
          </Link>
          {hasPermission("payroll.create") && (
            <Button render={<Link href="/payroll/new" />}>New Payroll Run</Button>
          )}
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

      {!error && runs === null && <PayrollTableSkeleton />}

      {!error && runs !== null && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Banknote className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No payroll runs yet</p>
          <p className="text-sm text-muted-foreground">Runs you create will show up here.</p>
        </div>
      )}

      {!error && runs !== null && runs.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Run date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Link href={`/payroll/${run.id}`} className="font-medium text-foreground hover:underline">
                      {MONTH_NAMES[run.month - 1]} {run.year}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{branchName(run.branch_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{run.run_date}</TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PayrollTableSkeleton() {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Run date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
