"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

import { getReceivableAgeingReport } from "@embroidery/types";
import type { ReceivableAgeingReportOut } from "@embroidery/types";

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
import { CategoricalBarChart } from "@/components/CategoricalBarChart";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReceivableAgeingReportPage() {
  const [asOf, setAsOf] = useState(today);
  const [report, setReport] = useState<ReceivableAgeingReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setReport(null);
    getReceivableAgeingReport({ as_of: asOf })
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view reports.");
        } else {
          setError("Could not load the receivable ageing report.");
        }
      });
  }, [asOf]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Receivable Ageing</h1>
        <p className="text-sm text-muted-foreground">
          Outstanding invoice balances by party, aged since each invoice&apos;s date.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">As of</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
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

      {!error && report === null && (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full max-w-2xl rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      )}

      {!error && report !== null && (
        <>
          <Card className="max-w-2xl">
            <CardContent className="grid grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total outstanding</p>
                <p className="text-lg font-semibold tabular-nums">{report.total_outstanding.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">0-30 days</p>
                <p className="font-semibold tabular-nums">{report.buckets.current.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">31-60 days</p>
                <p className="font-semibold tabular-nums">{report.buckets.days_31_60.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">61-90 days</p>
                <p className="font-semibold tabular-nums">{report.buckets.days_61_90.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">90+ days</p>
                <p className="font-semibold tabular-nums">{report.buckets.days_over_90.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          {report.total_outstanding > 0 && (
            <CategoricalBarChart
              data={[
                { label: "0-30 days", value: report.buckets.current },
                { label: "31-60 days", value: report.buckets.days_31_60 },
                { label: "61-90 days", value: report.buckets.days_61_90 },
                { label: "90+ days", value: report.buckets.days_over_90 },
              ]}
              valueFormatter={(v) => v.toFixed(2)}
            />
          )}

          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">0-30</TableHead>
                  <TableHead className="text-right">31-60</TableHead>
                  <TableHead className="text-right">61-90</TableHead>
                  <TableHead className="text-right">90+</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.parties.map((party) => (
                  <TableRow key={party.party_id}>
                    <TableCell>{party.party_name}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {party.total_outstanding.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{party.buckets.current.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{party.buckets.days_31_60.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{party.buckets.days_61_90.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{party.buckets.days_over_90.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {report.parties.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No outstanding balances.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
