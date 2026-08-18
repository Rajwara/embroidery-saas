"use client";

import { useCallback, useEffect, useState } from "react";

import { AlertCircle, Loader2 } from "lucide-react";

import {
  createScheduledReport,
  deleteScheduledReport,
  listBranches,
  listScheduledReports,
  updateScheduledReport,
} from "@embroidery/types";
import type { BranchOut, ScheduledReportSettingOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

const REPORT_TYPE_LABELS: Record<string, string> = {
  financial_summary: "Financial Summary",
};

export default function ScheduledReportsPage() {
  const { hasPermission } = useAuth();
  const [settings, setSettings] = useState<ScheduledReportSettingOut[] | null>(null);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [reportType, setReportType] = useState("financial_summary");
  const [frequency, setFrequency] = useState("weekly");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [branchId, setBranchId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setSettings(null);
    Promise.all([listScheduledReports(), listBranches()])
      .then(([settingsData, branchesData]) => {
        setSettings(settingsData);
        setBranches(branchesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view scheduled reports.");
        } else {
          setError("Could not load scheduled reports.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const branchName = (id: string | null) => (id ? branches.find((b) => b.id === id)?.name ?? "—" : "All branches");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createScheduledReport({
        report_type: reportType,
        frequency,
        recipient_email: recipientEmail,
        branch_id: branchId || undefined,
      });
      setRecipientEmail("");
      setBranchId("");
      load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (setting: ScheduledReportSettingOut) => {
    try {
      await updateScheduledReport(setting.id, { is_active: !setting.is_active });
      load();
    } catch {
      // no-op -- the row simply won't reflect the toggle, user can retry
    }
  };

  const handleDelete = async (setting: ScheduledReportSettingOut) => {
    if (!window.confirm(`Stop sending ${REPORT_TYPE_LABELS[setting.report_type] ?? setting.report_type}?`)) {
      return;
    }
    try {
      await deleteScheduledReport(setting.id);
      load();
    } catch {
      // no-op -- row stays, user can retry
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Scheduled Reports</h1>
        <p className="text-sm text-muted-foreground">
          Have a report emailed automatically. Weekly reports send every Monday for the prior week; monthly
          reports send on the 1st for the prior calendar month.
        </p>
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

      {!error && settings === null && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {!error && settings !== null && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Last sent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((setting) => (
                <TableRow key={setting.id}>
                  <TableCell className="font-medium">
                    {REPORT_TYPE_LABELS[setting.report_type] ?? setting.report_type}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{setting.frequency}</TableCell>
                  <TableCell className="text-muted-foreground">{branchName(setting.branch_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{setting.recipient_email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {setting.last_sent_at ? setting.last_sent_at.slice(0, 10) : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={setting.is_active ? "success" : "secondary"}>
                      {setting.is_active ? "Active" : "Paused"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {hasPermission("reports.export") && (
                      <div className="flex justify-end gap-3">
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => toggleActive(setting)}>
                          {setting.is_active ? "Pause" : "Resume"}
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-destructive"
                          onClick={() => handleDelete(setting)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {settings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No scheduled reports yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {hasPermission("reports.export") && (
        <form onSubmit={handleCreate} className="max-w-md space-y-4 rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold">Schedule a report</h2>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Report</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="financial_summary">Financial Summary</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="weekly">Weekly (Mondays)</option>
                <option value="monthly">Monthly (1st)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Recipient email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={submitting || !recipientEmail}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? "Scheduling..." : "Schedule report"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
