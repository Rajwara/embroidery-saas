"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";

import { AlertCircle, ClipboardList, Loader2 } from "lucide-react";

import {
  createAdvance,
  getEmployee,
  listAdvances,
  listBranches,
  listEmployeePayrollHistory,
  listProductionEntries,
  listSalaryProfiles,
} from "@embroidery/types";
import type {
  AdvanceOut,
  BranchOut,
  EmployeeOut,
  EmployeePayrollHistoryOut,
  EmployeeSalaryProfileOut,
  MachineProductionEntryOut,
} from "@embroidery/types";

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

const COMPONENT_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  sleeves: "Sleeves",
  trouser: "Trouser",
  dupatta: "Dupatta",
};

const SHIFT_LABELS: Record<string, string> = {
  morning: "Morning",
  evening: "Evening",
  night: "Night",
};

const ENTRY_STATUS_VARIANT: Record<string, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

const RUN_STATUS_VARIANT: Record<string, "warning" | "success" | "secondary"> = {
  draft: "warning",
  approved: "success",
  paid: "secondary",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function EmployeeDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { hasPermission } = useAuth();

  const [employee, setEmployee] = useState<EmployeeOut | null>(null);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [entries, setEntries] = useState<MachineProductionEntryOut[] | null>(null);
  const [salaryProfile, setSalaryProfile] = useState<EmployeeSalaryProfileOut | null | undefined>(undefined);
  const [payrollHistory, setPayrollHistory] = useState<EmployeePayrollHistoryOut[] | null>(null);
  const [advances, setAdvances] = useState<AdvanceOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setEmployee(null);
    Promise.all([
      getEmployee(params.id),
      listBranches().catch(() => []),
      listProductionEntries({ employee_id: params.id, limit: 200 }),
      listSalaryProfiles({ employee_id: params.id }),
      listEmployeePayrollHistory({ employee_id: params.id }),
      listAdvances({ employee_id: params.id }),
    ])
      .then(([employeeData, branchesData, entriesData, salaryProfiles, payrollData, advancesData]) => {
        setEmployee(employeeData);
        setBranches(branchesData);
        setEntries(entriesData);
        setSalaryProfile(salaryProfiles[0] ?? null);
        setPayrollHistory(payrollData);
        setAdvances(advancesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Employee not found.");
        } else if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view this employee.");
        } else {
          setError("Could not load this employee.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

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

  if (employee === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-32 w-full max-w-2xl rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const branchName = branches.find((b) => b.id === employee.branch_id)?.name ?? "—";

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{employee.full_name}</h1>
          <Badge variant={employee.is_active ? "success" : "secondary"}>
            {employee.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {employee.employee_code}
          {employee.designation && <> &middot; {employee.designation}</>} &middot; {branchName}
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="font-medium">{employee.phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{employee.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Hire date</p>
            <p className="font-medium">{employee.hire_date ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Employment status</p>
            <p className="font-medium capitalize">{employee.employment_status}</p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Salary</h2>
          <p className="text-sm text-muted-foreground">Current monthly baseline, before bonuses/deductions/advance recovery for a given run.</p>
        </div>
        {salaryProfile === undefined ? (
          <Skeleton className="h-16 w-full max-w-xs rounded-xl" />
        ) : salaryProfile === null ? (
          <p className="text-sm text-muted-foreground">
            No salary profile set up yet.{" "}
            <Link href="/payroll/salary-profiles" className="underline">
              Set one up
            </Link>
            .
          </p>
        ) : (
          <Card className="max-w-xs">
            <CardContent>
              <p className="text-sm text-muted-foreground">Basic salary</p>
              <p className="text-lg font-semibold tabular-nums">{salaryProfile.basic_salary.toFixed(2)}</p>
              {salaryProfile.notes && <p className="mt-1 text-xs text-muted-foreground">{salaryProfile.notes}</p>}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Production history</h2>
        {entries === null ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
            <ClipboardList className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No production entries yet</p>
            <p className="text-sm text-muted-foreground">
              Entries where this person is the operator or helper will show up here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Machine</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">{entry.entry_date}</TableCell>
                    <TableCell className="text-muted-foreground">{SHIFT_LABELS[entry.shift] ?? entry.shift}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.machine_code}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {COMPONENT_LABELS[entry.component_type] ?? entry.component_type}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.operator_employee_id === employee.id ? "Operator" : "Helper"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{entry.quantity}</TableCell>
                    <TableCell>
                      <Badge variant={ENTRY_STATUS_VARIANT[entry.status] ?? "secondary"} className="capitalize">
                        {entry.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payroll history</h2>
        {payrollHistory === null ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : payrollHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not included in any payroll run yet -- needs a salary profile first.
          </p>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Deduction</TableHead>
                  <TableHead className="text-right">Advance recovery</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Link href={`/payroll/${entry.payroll_run_id}`} className="font-medium hover:underline">
                        {MONTH_NAMES[entry.month - 1]} {entry.year}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{entry.basic_salary.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{entry.total_bonus.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{entry.total_deduction.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{entry.total_advance_recovery.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{entry.net_pay.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={RUN_STATUS_VARIANT[entry.run_status] ?? "secondary"} className="capitalize">
                        {entry.run_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Advances</h2>
        {advances === null ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : advances.length === 0 ? (
          <p className="text-sm text-muted-foreground">No advances recorded.</p>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell>
                      <Link href={`/payroll/advances/${advance.id}`} className="text-muted-foreground hover:underline">
                        {advance.advance_date}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{advance.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{advance.remaining_balance.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={ENTRY_STATUS_VARIANT[advance.status] ?? "secondary"} className="capitalize">
                        {advance.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{advance.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {hasPermission("payroll.create") && (
          <RequestAdvanceForm employeeId={employee.id} onCreated={load} />
        )}
      </section>
    </div>
  );
}

function RequestAdvanceForm({ employeeId, onCreated }: { employeeId: string; onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
      setAmount("");
      setReason("");
      onCreated();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-3 rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">Request a cash advance</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Amount</label>
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
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Date</label>
          <input
            type="date"
            value={advanceDate}
            onChange={(e) => setAdvanceDate(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Reason (optional)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {submitError && <p className="text-xs text-destructive">{submitError}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting || !amount}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? "Requesting..." : "Request advance"}
        </Button>
      </div>
    </form>
  );
}
