"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Wrench } from "lucide-react";

import { listProductionJobs } from "@embroidery/types";
import type { ProductionJobOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

import { StatusBadge } from "./_components/StatusBadge";

export default function ProductionJobsPage() {
  const { hasPermission } = useAuth();
  const [jobs, setJobs] = useState<ProductionJobOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setJobs(null);
    listProductionJobs()
      .then(setJobs)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view production jobs.");
        } else {
          setError("Could not load production jobs.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Production Jobs</h1>
        {hasPermission("production_jobs.create") && <Button render={<Link href="/jobs/new" />}>New Job</Button>}
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

      {!error && jobs === null && <JobsTableSkeleton />}

      {!error && jobs !== null && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Wrench className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No production jobs yet</p>
          <p className="text-sm text-muted-foreground">Jobs you create will show up here.</p>
        </div>
      )}

      {!error && jobs !== null && jobs.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot #</TableHead>
                <TableHead>Colour</TableHead>
                <TableHead>Design</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link href={`/jobs/${job.id}`} className="font-medium text-foreground hover:underline">
                      {job.lot_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{job.colour_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {job.design_master_number} &middot; {job.design_name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={job.status} />
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

function JobsTableSkeleton() {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lot #</TableHead>
            <TableHead>Colour</TableHead>
            <TableHead>Design</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
