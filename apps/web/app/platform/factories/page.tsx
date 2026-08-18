"use client";

import { useCallback, useEffect, useState } from "react";

import { AlertCircle } from "lucide-react";

import { listSubscriberFactories, updateSubscriberFactory } from "@embroidery/types";
import type { SubscriberFactoryOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
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

const PLAN_OPTIONS = ["trial", "starter", "pro", "enterprise"];
const STATUS_OPTIONS = ["trialing", "active", "past_due", "canceled"];

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "secondary"> = {
  active: "success",
  trialing: "warning",
  past_due: "warning",
  canceled: "secondary",
};

export default function SubscriberFactoriesPage() {
  const [factories, setFactories] = useState<SubscriberFactoryOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setFactories(null);
    listSubscriberFactories()
      .then(setFactories)
      .catch((err) => {
        setError(err instanceof ApiError ? err.detail : "Could not load subscriber factories.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = async (
    tenantId: string,
    patch: { subscription_plan?: string; subscription_status?: string; is_active?: boolean }
  ) => {
    setRowError(null);
    setSavingId(tenantId);
    try {
      const updated = await updateSubscriberFactory(tenantId, patch);
      setFactories((prev) => (prev ? prev.map((f) => (f.id === tenantId ? updated : f)) : prev));
    } catch (err) {
      setRowError(err instanceof ApiError ? err.detail : "Could not update this factory.");
    } finally {
      setSavingId(null);
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

  if (factories === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Subscriber Factories</h1>
      <p className="text-sm text-muted-foreground">
        Account and subscription metadata only -- this list intentionally never shows a factory&apos;s
        business data (parties, invoices, production, etc.).
      </p>

      {rowError && <p className="text-sm text-destructive">{rowError}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Renews</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {factories.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell>
                  {editingId === f.id ? (
                    <select
                      value={f.subscription_plan}
                      disabled={savingId === f.id}
                      onChange={(e) => handleUpdate(f.id, { subscription_plan: e.target.value })}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                    >
                      {PLAN_OPTIONS.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-muted-foreground">{f.subscription_plan}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === f.id ? (
                    <select
                      value={f.subscription_status}
                      disabled={savingId === f.id}
                      onChange={(e) => handleUpdate(f.id, { subscription_status: e.target.value })}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant={STATUS_BADGE_VARIANT[f.subscription_status] ?? "secondary"}>
                      {f.subscription_status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{f.subscription_renews_at ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{f.user_count}</TableCell>
                <TableCell>
                  <Badge variant={f.is_active ? "success" : "secondary"}>{f.is_active ? "Yes" : "No"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {editingId === f.id ? (
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setEditingId(null)}>
                      Done
                    </Button>
                  ) : (
                    <div className="flex justify-end gap-3">
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setEditingId(f.id)}>
                        Edit
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        disabled={savingId === f.id}
                        onClick={() => handleUpdate(f.id, { is_active: !f.is_active })}
                      >
                        {f.is_active ? "Suspend" : "Reactivate"}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {factories.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No factories yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
