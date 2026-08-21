"use client";

import { useCallback, useEffect, useState } from "react";

import { advancePurchaseRequired, listPurchaseRequired, rejectPurchaseRequired } from "@embroidery/types";
import type { PurchaseRequiredOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  purchase_required: "Purchase Required",
  pending_approval: "Pending Approval",
  approved: "Approved",
  ordered: "Ordered",
  purchased: "Purchased",
  received: "Received",
  rejected: "Rejected",
};

const PIPELINE = ["purchase_required", "pending_approval", "approved", "ordered", "purchased", "received"];

export default function PurchaseRequiredPage() {
  const [rows, setRows] = useState<PurchaseRequiredOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(true);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    listPurchaseRequired({ open_only: openOnly })
      .then(setRows)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reorder requests.");
        } else {
          setError("Could not load reorder requests.");
        }
      });
  }, [openOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reorder Requests</h1>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Open only
        </label>
      </div>

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
        <p className="text-sm text-gray-500">Nothing here.</p>
      )}

      {!error && rows !== null && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((row) => (
            <PurchaseRequiredRow key={row.id} row={row} onAdvanced={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function PurchaseRequiredRow({ row, onAdvanced }: { row: PurchaseRequiredOut; onAdvanced: () => void }) {
  const [receivedQuantity, setReceivedQuantity] = useState(String(row.requested_quantity));
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isReceived = row.status === "received";
  const isRejected = row.status === "rejected";
  const isOpen = !isReceived && !isRejected;
  const isFinalStep = row.status === "purchased";

  const handleAdvance = async () => {
    setActionError(null);
    setSubmitting(true);
    try {
      await advancePurchaseRequired(row.id, {
        received_quantity: isFinalStep ? Number(receivedQuantity) : undefined,
      });
      onAdvanced();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setActionError(null);
    setSubmitting(true);
    try {
      await rejectPurchaseRequired(row.id, { reason: reason || undefined });
      onAdvanced();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded bg-white p-4 shadow">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">{row.item_name}</div>
          <div className="text-xs text-gray-500">
            Current stock: {row.current_stock} {row.item_unit} &middot; Requested: {row.requested_quantity}{" "}
            {row.item_unit}
          </div>
        </div>
        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium">
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
        {PIPELINE.map((stage, i) => (
          <span key={stage} className={PIPELINE.indexOf(row.status) >= i ? "font-semibold text-gray-700" : ""}>
            {STATUS_LABELS[stage]}
            {i < PIPELINE.length - 1 && " → "}
          </span>
        ))}
      </div>

      {isRejected && row.rejection_reason && (
        <p className="mt-1 text-xs text-gray-500">Reason: {row.rejection_reason}</p>
      )}

      {actionError && <p className="mt-2 text-xs text-red-600">{actionError}</p>}

      {isOpen && !showReject && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {isFinalStep && (
            <input
              type="number"
              min={1}
              value={receivedQuantity}
              onChange={(e) => setReceivedQuantity(e.target.value)}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          )}
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={submitting}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reject
          </button>
          <button
            onClick={handleAdvance}
            disabled={submitting}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "..." : isFinalStep ? "Mark received" : "Advance"}
          </button>
        </div>
      )}

      {isOpen && showReject && (
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
