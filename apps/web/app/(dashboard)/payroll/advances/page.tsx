"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { AlertCircle, Loader2 } from "lucide-react";

import { createAdvance, listAdvances, listEmployees } from "@embroidery/types";
import type { AdvanceOut, EmployeeOut } from "@embroidery/types";

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

export default function AdvancesPage() {
  const { hasPermission } = useAuth();
  const [advances, setAdvances] = useState<AdvanceOut[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [advanceDate, setAdvanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setAdvances(null);
    Promise.all([listAdvances({ open_only: openOnly }), listEmployees()])
      .then(([advancesData, employeesData]) => {
        setAdvances(advancesData);
        setEmployees(employeesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view payroll.");
        } else {
          setError("Could not load advances.");
        }
      });
  }, [openOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createAdvance({
        employee_id: employeeId,
        advance_date: advanceDate,
        amount: Number(amount),
        reason: reason || undefined,
      });
      setEmployeeId("");
      setAmount("");
      setReason("");
      load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Advances</h1>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Open only
        </label>
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

      {!error && advances === null && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {!error && advances !== null && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advances.map((advance) => (
                <TableRow key={advance.id}>
                  <TableCell>
                    <Link href={`/payroll/advances/${advance.id}`} className="font-medium text-foreground hover:underline">
                      {advance.employee_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{advance.advance_date}</TableCell>
                  <TableCell className="text-right tabular-nums">{advance.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{advance.remaining_balance.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">{advance.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
              {advances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No advances found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {hasPermission("payroll.create") && (
        <form onSubmit={handleCreate} className="max-w-md space-y-4 rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold">Record advance</h2>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select an employee
              </option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Date</label>
              <input
                type="date"
                value={advanceDate}
                onChange={(e) => setAdvanceDate(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Amount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={submitting || !employeeId || !amount}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? "Recording..." : "Record advance"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
