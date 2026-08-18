"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Shapes } from "lucide-react";

import { listDesigns } from "@embroidery/types";
import type { DesignOut } from "@embroidery/types";

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

export default function DesignsPage() {
  const { hasPermission } = useAuth();
  const [designs, setDesigns] = useState<DesignOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setDesigns(null);
    listDesigns()
      .then(setDesigns)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view designs.");
        } else {
          setError("Could not load designs.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Designs</h1>
        {hasPermission("designs.create") && (
          <Button render={<Link href="/designs/new" />}>New Design</Button>
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

      {!error && designs === null && <DesignsTableSkeleton />}

      {!error && designs !== null && designs.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Shapes className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No designs yet</p>
          <p className="text-sm text-muted-foreground">Designs you add will show up here.</p>
        </div>
      )}

      {!error && designs !== null && designs.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Master #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {designs.map((design) => (
                <TableRow key={design.id}>
                  <TableCell>
                    <Link href={`/designs/${design.id}`} className="font-medium text-foreground hover:underline">
                      {design.master_number}
                    </Link>
                  </TableCell>
                  <TableCell>{design.name}</TableCell>
                  <TableCell className="text-muted-foreground">{design.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function DesignsTableSkeleton() {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Master #</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
