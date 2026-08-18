"use client";

import { useCallback, useEffect, useState, use } from "react";

import { AlertCircle, History } from "lucide-react";

import { getAdvance } from "@embroidery/types";
import type { AdvanceDetailOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export default function AdvanceDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [advance, setAdvance] = useState<AdvanceDetailOut | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{advance.employee_name}</h1>
        <p className="text-sm text-muted-foreground">
          Advance of {advance.amount.toFixed(2)} on {advance.advance_date}
        </p>
        {advance.reason && <p className="mt-1 text-sm text-muted-foreground">{advance.reason}</p>}
      </div>

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
