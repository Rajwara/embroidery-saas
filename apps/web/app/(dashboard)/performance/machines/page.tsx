"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AlertCircle, Gauge } from "lucide-react";

import { getMachinePerformance, listMachines, listProductionEntries } from "@embroidery/types";
import type { MachineOut, MachinePerformanceOut, MachineProductionEntryOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const RECENT_ACTIVITY_LIMIT = 5;

const SHIFT_LABELS: Record<string, string> = {
  morning: "Morning",
  evening: "Evening",
  night: "Night",
};

interface CardData {
  performance: MachinePerformanceOut;
  machine?: MachineOut;
  recentEntries: MachineProductionEntryOut[];
}

// Stitch counts are computed from DesignVariant.stitch_count, which is
// nullable and often unset (see app/stitch_resolution.py) -- showing "0
// stitches" for real production would misrepresent it as verified-zero, so
// the primary figure falls back to piece count with a note instead. Mirrors
// the same fallback used by PerformanceBarChart's headline().
function headline(row: MachinePerformanceOut): string {
  if (row.total_stitches > 0 && row.quantity_missing_stitch_count === 0) {
    return `${row.total_stitches.toLocaleString()} stitches`;
  }
  if (row.total_stitches > 0) {
    return `${row.total_stitches.toLocaleString()} stitches + ${row.quantity_missing_stitch_count.toLocaleString()} units (no stitch count set)`;
  }
  return `${row.total_quantity.toLocaleString()} units (stitch count not set)`;
}

export default function MachinePerformancePage() {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [cards, setCards] = useState<CardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setCards(null);
    Promise.all([
      getMachinePerformance({ start_date: startDate || undefined, end_date: endDate || undefined }),
      listMachines(),
    ])
      .then(async ([performanceRows, machines]) => {
        const recentByMachine = await Promise.all(
          performanceRows.map((row) =>
            listProductionEntries({ machine_id: row.machine_id, limit: RECENT_ACTIVITY_LIMIT })
          )
        );
        setCards(
          performanceRows.map((row, i) => ({
            performance: row,
            machine: machines.find((m) => m.id === row.machine_id),
            recentEntries: recentByMachine[i],
          }))
        );
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view machine performance.");
        } else {
          setError("Could not load machine performance.");
        }
      });
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Machine Performance</h1>
        <p className="text-sm text-muted-foreground">
          Share of total approved production per machine{startDate || endDate ? " in the selected range" : ""}.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {(startDate || endDate) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear
          </Button>
        )}
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

      {!error && cards === null && <MachinePerformanceGridSkeleton />}

      {!error && cards !== null && cards.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Gauge className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No approved production entries yet</p>
          <p className="text-sm text-muted-foreground">
            Machine performance will show up here once production entries are approved.
          </p>
        </div>
      )}

      {!error && cards !== null && cards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <MachinePerformanceCard
              key={card.performance.machine_id}
              card={card}
              onClick={() => router.push(`/machines/${card.performance.machine_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MachinePerformanceCard({ card, onClick }: { card: CardData; onClick: () => void }) {
  const { performance, machine, recentEntries } = card;
  const width = Math.max(0, Math.min(100, performance.percentage_of_total));

  return (
    <Card className="cursor-pointer transition-colors hover:border-foreground/30" onClick={onClick}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-semibold">{performance.machine_code}</span>
            <p className="text-sm text-muted-foreground">
              {machine?.name ?? "—"}
              {machine?.machine_type ? ` · ${machine.machine_type}` : ""}
            </p>
          </div>
          <Badge variant="secondary">{performance.percentage_of_total.toFixed(1)}%</Badge>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div>
            <p className="text-muted-foreground">Output</p>
            <p className="font-medium text-foreground">{headline(performance)}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Entries</p>
            <p className="font-medium text-foreground">{performance.entry_count}</p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="mb-1.5 font-medium text-foreground">Recent activity</p>
          {recentEntries.length === 0 ? (
            <p className="text-muted-foreground">No recent entries.</p>
          ) : (
            <div className="space-y-1.5">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="text-foreground">{entry.entry_date}</span>
                  <span className="truncate">
                    {entry.operator_name} · {entry.component_type}
                    {SHIFT_LABELS[entry.shift] ? ` · ${SHIFT_LABELS[entry.shift]}` : ""}
                  </span>
                  <span className="shrink-0 font-medium text-foreground">{entry.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MachinePerformanceGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
