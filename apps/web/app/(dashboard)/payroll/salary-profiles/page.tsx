"use client";

import { useCallback, useEffect, useState } from "react";

import { AlertCircle, Loader2 } from "lucide-react";

import { createSalaryProfile, listEmployees, listSalaryProfiles, updateSalaryProfile } from "@embroidery/types";
import type { EmployeeOut, EmployeeSalaryProfileOut } from "@embroidery/types";

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

export default function SalaryProfilesPage() {
  const { hasPermission } = useAuth();
  const [profiles, setProfiles] = useState<EmployeeSalaryProfileOut[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSalary, setEditSalary] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setProfiles(null);
    Promise.all([listSalaryProfiles(), listEmployees()])
      .then(([profilesData, employeesData]) => {
        setProfiles(profilesData);
        setEmployees(employeesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view payroll.");
        } else {
          setError("Could not load salary profiles.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const employeesWithoutProfile = employees.filter(
    (employee) => !profiles?.some((p) => p.employee_id === employee.id)
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createSalaryProfile({
        employee_id: employeeId,
        basic_salary: Number(basicSalary),
        notes: notes || undefined,
      });
      setEmployeeId("");
      setBasicSalary("");
      setNotes("");
      load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (profile: EmployeeSalaryProfileOut) => {
    setEditingId(profile.id);
    setEditSalary(String(profile.basic_salary));
  };

  const saveEdit = async (profileId: string) => {
    setEditSaving(true);
    try {
      await updateSalaryProfile(profileId, { basic_salary: Number(editSalary) });
      setEditingId(null);
      load();
    } catch {
      // leave the row in edit mode so the user can retry
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Employee Salary Profiles</h1>

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

      {!error && profiles === null && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {!error && profiles !== null && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Basic salary</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.employee_name}</TableCell>
                  <TableCell className="tabular-nums">
                    {editingId === profile.id ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editSalary}
                        onChange={(e) => setEditSalary(e.target.value)}
                        className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      profile.basic_salary.toFixed(2)
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{profile.notes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {hasPermission("payroll.create") &&
                      (editingId === profile.id ? (
                        <div className="flex justify-end gap-3">
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            onClick={() => saveEdit(profile.id)}
                            disabled={editSaving}
                          >
                            {editSaving && <Loader2 className="animate-spin" />}
                            Save
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-muted-foreground"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => startEdit(profile)}>
                          Edit
                        </Button>
                      ))}
                  </TableCell>
                </TableRow>
              ))}
              {profiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No salary profiles yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {hasPermission("payroll.create") && (
        <form onSubmit={handleCreate} className="max-w-md space-y-4 rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold">Add salary profile</h2>
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
              {employeesWithoutProfile.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Basic salary</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={submitting || !employeeId || !basicSalary}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? "Adding..." : "Add profile"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
