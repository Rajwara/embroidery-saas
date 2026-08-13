"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  advancePurchaseRequired,
  approveProductionEntry,
  listPayrollRuns,
  listProductionEntries,
  listPurchaseRequired,
  rejectProductionEntry,
} from "@embroidery/types";
import type { MachineProductionEntryOut, PayrollRunOut, PurchaseRequiredOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ApprovalsCentrePage() {
  const { hasPermission } = useAuth();

  const canApproveProduction = hasPermission("production_entries.approve");
  const canApprovePurchaseRequired = hasPermission("inventory.edit");
  const canApprovePayroll = hasPermission("payroll.approve");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Approvals</h1>

      {!canApproveProduction && !canApprovePurchaseRequired && !canApprovePayroll && (
        <p className="text-sm text-gray-500">You don&apos;t have permission to approve anything here.</p>
      )}

      {canApproveProduction && <ProductionEntriesSection />}
      {canApprovePurchaseRequired && <PurchaseRequiredSection />}
      {canApprovePayroll && <PayrollRunsSection />}
    </div>
  );
}

function ProductionEntriesSection() {
  const [entries, setEntries] = useState<MachineProductionEntryOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setEntries(null);
    listProductionEntries({ status: "pending" })
      .then(setEntries)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view production entries.");
        } else {
          setError("Could not load pending production entries.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const removeEntry = (id: string) => {
    setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Production Entries</h2>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && entries === null && <p className="text-sm text-gray-500">Loading...</p>}
      {!error && entries !== null && entries.length === 0 && (
        <p className="text-sm text-gray-500">No entries pending approval.</p>
      )}

      {!error && entries !== null && entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry) => (
            <ProductionEntryRow key={entry.id} entry={entry} onResolved={() => removeEntry(entry.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

interface ProductionEntryRowProps {
  entry: MachineProductionEntryOut;
  onResolved: () => void;
}

function ProductionEntryRow({ entry, onResolved }: ProductionEntryRowProps) {
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApprove = async () => {
    setActionError(null);
    setSubmitting(true);
    try {
      await approveProductionEntry(entry.id);
      onResolved();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setActionError(null);
    setSubmitting(true);
    try {
      await rejectProductionEntry(entry.id, { reason: reason || undefined });
      onResolved();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded bg-white p-4 shadow">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium">{entry.machine_code}</span> &middot;{" "}
          {COMPONENT_LABELS[entry.component_type] ?? entry.component_type} &middot; {entry.entry_date} &middot;{" "}
          {SHIFT_LABELS[entry.shift] ?? entry.shift}
        </div>
        <div className="text-sm font-semibold">{entry.quantity} units</div>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        Operator: {entry.operator_name}
        {entry.helper_name && <> &middot; Helper: {entry.helper_name}</>}
        {entry.notes && <> &middot; {entry.notes}</>}
      </div>

      {actionError && <p className="mt-2 text-xs text-red-600">{actionError}</p>}

      {!showReject ? (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={submitting}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={submitting}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "..." : "Approve"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => setShowReject(false)}
            disabled={submitting}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={submitting}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "..." : "Confirm reject"}
          </button>
        </div>
      )}
    </div>
  );
}

function PurchaseRequiredSection() {
  const [rows, setRows] = useState<PurchaseRequiredOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    listPurchaseRequired({ status: "pending_approval" })
      .then(setRows)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view purchase requests.");
        } else {
          setError("Could not load pending purchase requests.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const removeRow = (id: string) => {
    setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Purchase Required</h2>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && rows === null && <p className="text-sm text-gray-500">Loading...</p>}
      {!error && rows !== null && rows.length === 0 && (
        <p className="text-sm text-gray-500">No purchase requests pending approval.</p>
      )}

      {!error && rows !== null && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((row) => (
            <PurchaseRequiredRow key={row.id} row={row} onResolved={() => removeRow(row.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function PurchaseRequiredRow({ row, onResolved }: { row: PurchaseRequiredOut; onResolved: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApprove = async () => {
    setActionError(null);
    setSubmitting(true);
    try {
      await advancePurchaseRequired(row.id, {});
      onResolved();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded bg-white p-4 shadow">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium">{row.item_name}</span> &middot; requested {row.requested_quantity}{" "}
          {row.item_unit} &middot; current stock {row.current_stock} {row.item_unit}
        </div>
        <button
          type="button"
          onClick={handleApprove}
          disabled={submitting}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "..." : "Approve"}
        </button>
      </div>
      {row.notes && <p className="mt-1 text-xs text-gray-500">{row.notes}</p>}
      {actionError && <p className="mt-2 text-xs text-red-600">{actionError}</p>}
    </div>
  );
}

function PayrollRunsSection() {
  const [runs, setRuns] = useState<PayrollRunOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRuns(null);
    listPayrollRuns()
      .then((allRuns) => setRuns(allRuns.filter((run) => run.status === "draft")))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view payroll.");
        } else {
          setError("Could not load pending payroll runs.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Payroll Runs</h2>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!error && runs === null && <p className="text-sm text-gray-500">Loading...</p>}
      {!error && runs !== null && runs.length === 0 && (
        <p className="text-sm text-gray-500">No payroll runs pending approval.</p>
      )}

      {!error && runs !== null && runs.length > 0 && (
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="flex items-center justify-between rounded bg-white p-4 shadow">
              <div className="text-sm font-medium">
                {MONTH_NAMES[run.month - 1]} {run.year}
              </div>
              <Link
                href={`/payroll/${run.id}`}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
              >
                Review &amp; approve →
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
