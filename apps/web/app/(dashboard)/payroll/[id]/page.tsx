"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";

import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  addAdvanceInstallment,
  addBonus,
  addDeduction,
  approvePayrollRun,
  getPayrollRun,
  listAdvances,
} from "@embroidery/types";
import type { AdvanceOut, PayrollEntryOut, PayrollRunDetailOut } from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

import { StatusBadge } from "../_components/StatusBadge";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type AdjustmentType = "bonus" | "deduction" | "advance_installment";

export default function PayrollRunDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { hasPermission } = useAuth();
  const [run, setRun] = useState<PayrollRunDetailOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("bonus");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [installmentDate, setInstallmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [openAdvances, setOpenAdvances] = useState<AdvanceOut[]>([]);
  const [advanceId, setAdvanceId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmingApprove, setConfirmingApprove] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRun(null);
    getPayrollRun(params.id)
      .then(setRun)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Payroll run not found.");
        } else {
          setError("Could not load payroll run.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (adjustmentType !== "advance_installment" || !employeeId) {
      setOpenAdvances([]);
      setAdvanceId("");
      return;
    }
    listAdvances({ employee_id: employeeId, open_only: true })
      .then((advances) => {
        setOpenAdvances(advances);
        setAdvanceId(advances[0]?.id ?? "");
      })
      .catch(() => setOpenAdvances([]));
  }, [adjustmentType, employeeId]);

  const resetForm = () => {
    setAmount("");
    setReason("");
    setAdvanceId("");
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!run) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const amountNum = Number(amount);
      if (adjustmentType === "bonus") {
        await addBonus(run.id, { employee_id: employeeId, amount: amountNum, reason: reason || undefined });
      } else if (adjustmentType === "deduction") {
        await addDeduction(run.id, { employee_id: employeeId, amount: amountNum, reason: reason || undefined });
      } else {
        if (!advanceId) {
          setFormError("Select an advance to recover against.");
          setSubmitting(false);
          return;
        }
        await addAdvanceInstallment(run.id, {
          employee_id: employeeId,
          advance_id: advanceId,
          amount: amountNum,
          installment_date: installmentDate,
        });
      }
      resetForm();
      load();
      toast.success("Added");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmApprove = async () => {
    if (!run) return;
    setApproveError(null);
    setApproving(true);
    try {
      const updated = await approvePayrollRun(run.id);
      setRun(updated);
      setConfirmingApprove(false);
      toast.success("Payroll run approved");
    } catch (err) {
      setApproveError(err instanceof ApiError ? err.detail : "Could not approve payroll run.");
    } finally {
      setApproving(false);
    }
  };

  const handlePrint = async (entry: PayrollEntryOut) => {
    setPdfError(null);
    setPdfLoadingId(entry.id);
    try {
      const blob = await fetchPdfBlob(`/payroll-runs/${params.id}/entries/${entry.employee_id}/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setPdfError("Could not generate the salary slip. Please try again.");
    } finally {
      setPdfLoadingId(null);
    }
  };

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

  if (run === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const isDraft = run.status === "draft";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {MONTH_NAMES[run.month - 1]} {run.year}
          </h1>
          <p className="text-sm text-muted-foreground">Run date: {run.run_date}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={run.status} />
          {isDraft && hasPermission("payroll.approve") && (
            <Button onClick={() => setConfirmingApprove(true)} disabled={approving}>
              {approving && <Loader2 className="animate-spin" />}
              {approving ? "Approving..." : "Approve payroll run"}
            </Button>
          )}
        </div>
      </div>

      {approveError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{approveError}</AlertTitle>
        </Alert>
      )}
      {pdfError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{pdfError}</AlertTitle>
        </Alert>
      )}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Basic</TableHead>
              <TableHead className="text-right">Bonus</TableHead>
              <TableHead className="text-right">Deduction</TableHead>
              <TableHead className="text-right">Advance recovery</TableHead>
              <TableHead className="text-right">Net pay</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.employee_name}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.basic_salary.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.total_bonus.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.total_deduction.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.total_advance_recovery.toFixed(2)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{entry.net_pay.toFixed(2)}</TableCell>
                <TableCell>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => handlePrint(entry)}
                    disabled={pdfLoadingId === entry.id}
                  >
                    {pdfLoadingId === entry.id ? "Generating..." : "Salary slip"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {run.entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No entries in this payroll run. Only active employees with a salary profile are
                  included when a run is created --{" "}
                  <Link href="/payroll/salary-profiles" className="underline">
                    set one up
                  </Link>{" "}
                  and create a new run for this branch and period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isDraft && run.entries.length > 0 && hasPermission("payroll.create") && (
        <form onSubmit={handleAddAdjustment} className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold">Add bonus, deduction, or advance recovery</h2>
          <div className="grid grid-cols-2 gap-4">
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
                {run.entries.map((entry) => (
                  <option key={entry.employee_id} value={entry.employee_id}>
                    {entry.employee_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Type</label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as AdjustmentType)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="bonus">Bonus</option>
                <option value="deduction">Deduction</option>
                <option value="advance_installment">Advance recovery</option>
              </select>
            </div>
          </div>

          {adjustmentType === "advance_installment" && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Advance</label>
              <select
                value={advanceId}
                onChange={(e) => setAdvanceId(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  {employeeId ? "Select an advance" : "Select an employee first"}
                </option>
                {openAdvances.map((advance) => (
                  <option key={advance.id} value={advance.id}>
                    {advance.advance_date} &middot; remaining {advance.remaining_balance.toFixed(2)}
                  </option>
                ))}
              </select>
              {employeeId && openAdvances.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">This employee has no open advances.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
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
            {adjustmentType === "advance_installment" ? (
              <div>
                <label className="block text-sm font-medium text-muted-foreground">Installment date</label>
                <input
                  type="date"
                  value={installmentDate}
                  onChange={(e) => setInstallmentDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-muted-foreground">Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={submitting || !employeeId || !amount}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? "Adding..." : "Add"}
            </Button>
          </div>
        </form>
      )}

      <AlertDialog open={confirmingApprove} onOpenChange={(open) => !open && setConfirmingApprove(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this payroll run?</AlertDialogTitle>
            <AlertDialogDescription>
              No further bonuses, deductions, or advance recoveries can be added afterward. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove} disabled={approving}>
              {approving && <Loader2 className="animate-spin" />}
              {approving ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
