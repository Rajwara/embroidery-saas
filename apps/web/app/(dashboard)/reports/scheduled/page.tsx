"use client";

import { useCallback, useEffect, useState } from "react";

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
        <p className="text-sm text-gray-500">
          Have a report emailed automatically. Weekly reports send every Monday for the prior week; monthly
          reports send on the 1st for the prior calendar month.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && settings === null && <p className="text-sm text-gray-500">Loading...</p>}

      {!error && settings !== null && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Report</th>
              <th className="px-4 py-2 font-medium">Frequency</th>
              <th className="px-4 py-2 font-medium">Branch</th>
              <th className="px-4 py-2 font-medium">Recipient</th>
              <th className="px-4 py-2 font-medium">Last sent</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {settings.map((setting) => (
              <tr key={setting.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">{REPORT_TYPE_LABELS[setting.report_type] ?? setting.report_type}</td>
                <td className="px-4 py-2 capitalize">{setting.frequency}</td>
                <td className="px-4 py-2">{branchName(setting.branch_id)}</td>
                <td className="px-4 py-2">{setting.recipient_email}</td>
                <td className="px-4 py-2">{setting.last_sent_at ? setting.last_sent_at.slice(0, 10) : "Never"}</td>
                <td className="px-4 py-2">{setting.is_active ? "Active" : "Paused"}</td>
                <td className="px-4 py-2 text-right">
                  {hasPermission("reports.export") && (
                    <div className="flex justify-end gap-3">
                      <button onClick={() => toggleActive(setting)} className="text-xs font-medium text-gray-700 underline">
                        {setting.is_active ? "Pause" : "Resume"}
                      </button>
                      <button onClick={() => handleDelete(setting)} className="text-xs font-medium text-red-600 underline">
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {settings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  No scheduled reports yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {hasPermission("reports.export") && (
        <form onSubmit={handleCreate} className="max-w-md space-y-4 rounded bg-white p-6 shadow">
          <h2 className="text-sm font-semibold">Schedule a report</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Report</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="financial_summary">Financial Summary</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="weekly">Weekly (Mondays)</option>
                <option value="monthly">Monthly (1st)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
            <label className="block text-sm font-medium text-gray-700">Recipient email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={submitting || !recipientEmail}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Scheduling..." : "Schedule report"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
