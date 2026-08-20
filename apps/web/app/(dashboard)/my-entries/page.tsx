"use client";

import { useCallback, useEffect, useState } from "react";

import { AlertCircle, ClipboardList } from "lucide-react";

import { listProductionEntries, listProductionJobs } from "@embroidery/types";
import type { MachineProductionEntryOut, ProductionJobOut } from "@embroidery/types";

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

const STATUS_BADGE_VARIANT: Record<string, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

export default function MyLoggedEntriesPage() {
  const [entries, setEntries] = useState<MachineProductionEntryOut[] | null>(null);
  const [jobs, setJobs] = useState<ProductionJobOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setEntries(null);
    Promise.all([listProductionEntries({ mine_only: true }), listProductionJobs()])
      .then(([entriesData, jobsData]) => {
        setEntries(entriesData);
        setJobs(jobsData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view production entries.");
        } else {
          setError("Could not load your logged entries.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lotNumber = (productionJobId: string) =>
    jobs.find((j) => j.id === productionJobId)?.lot_number ?? "—";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My Logged Entries</h1>
        <p className="text-sm text-muted-foreground">
          Production entries you&apos;ve submitted, and where they stand in the approval queue.
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

      {!error && entries === null && <EntriesTableSkeleton />}

      {!error && entries !== null && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No logged entries yet</p>
          <p className="text-sm text-muted-foreground">Entries you submit on the Daily Shift screen will show up here.</p>
        </div>
      )}

      {!error && entries !== null && entries.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground">{entry.entry_date}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {SHIFT_LABELS[entry.shift] ?? entry.shift}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lotNumber(entry.production_job_id)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {COMPONENT_LABELS[entry.component_type] ?? entry.component_type}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.machine_code}</TableCell>
                  <TableCell className="text-right tabular-nums">{entry.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[entry.status] ?? "secondary"} className="capitalize">
                      {entry.status}
                    </Badge>
                    {entry.status === "rejected" && entry.rejection_reason && (
                      <p className="mt-1 text-xs text-muted-foreground">{entry.rejection_reason}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EntriesTableSkeleton() {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Shift</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Component</TableHead>
            <TableHead>Machine</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-10" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
