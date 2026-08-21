"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";

import { AlertCircle, History, Loader2, Pencil } from "lucide-react";

import { getAdvance, updateAdvance } from "@embroidery/types";
import type { AdvanceDetailOut } from "@embroidery/types";

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

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

export default function AdvanceDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { hasPermission } = useAuth();
  const [advance, setAdvance] = useState<AdvanceDetailOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setAdvance(null);
    getAdvance(params.id)
      .then(setAdvance)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Advance not found.");
        } else {
          setError("Could not load advance.");
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

  if (advance === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-24 w-full max-w-sm rounded-xl" />
      </div>
    );
  }

  const canEdit = hasPermission("payroll.create") && advance.status === "pending";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">
              <Link href={`/employees/${advance.employee_id}`} className="hover:underline">
                {advance.employee_name}
              </Link>
            </h1>
            <Badge variant={STATUS_VARIANT[advance.status] ?? "secondary"} className="capitalize">
              {advance.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Advance of {advance.amount.toFixed(2)} on {advance.advance_date}
          </p>
          {advance.reason && <p className="mt-1 text-sm text-muted-foreground">{advance.reason}</p>}
          {advance.status === "rejected" && advance.rejection_reason && (
            <p className="mt-1 text-sm text-destructive">Reason: {advance.rejection_reason}</p>
          )}
        </div>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <EditAdvanceForm
          advance={advance}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setAdvance({ ...advance, ...updated });
            setEditing(false);
          }}
        />
      ) : (
        <Card className="max-w-sm">
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Amount</p>
              <p className="font-semibold tabular-nums">{advance.amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining balance</p>
              <p className="font-semibold tabular-nums">{advance.remaining_balance.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Recovery history</h2>
        {advance.installments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
            <History className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No recoveries recorded yet. Record one from the relevant payroll run.</p>
          </div>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advance.installments.map((installment) => (
                  <TableRow key={installment.id}>
                    <TableCell className="text-muted-foreground">{installment.installment_date}</TableCell>
                    <TableCell className="text-right tabular-nums">{installment.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function EditAdvanceForm({
  advance,
  onCancel,
  onSaved,
}: {
  advance: AdvanceDetailOut;
  onCancel: () => void;
  onSaved: (updated: AdvanceDetailOut) => void;
}) {
  const [amount, setAmount] = useState(String(advance.amount));
  const [advanceDate, setAdvanceDate] = useState(advance.advance_date);
  const [reason, setReason] = useState(advance.reason ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const updated = await updateAdvance(advance.id, {
        amount: Number(amount),
        advance_date: advanceDate,
        reason: reason || undefined,
      });
      onSaved({ ...advance, ...updated });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-3 rounded-xl border bg-card p-4">
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
        <label className="block text-xs font-medium text-muted-foreground">Reason</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {submitError && <p className="text-xs text-destructive">{submitError}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting || !amount}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
