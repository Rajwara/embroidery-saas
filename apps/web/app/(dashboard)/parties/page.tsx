"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { AlertCircle, Users } from "lucide-react";

import { listParties } from "@embroidery/types";
import type { Party } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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

export default function PartiesPage() {
  const { hasPermission } = useAuth();
  const [parties, setParties] = useState<Party[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSeeMoney = hasPermission("parties.see_money");

  const load = useCallback(() => {
    setError(null);
    setParties(null);
    listParties()
      .then(setParties)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view parties.");
        } else {
          setError("Could not load parties.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Parties</h1>
        {hasPermission("parties.create") && <Button render={<Link href="/parties/new" />}>Add Party</Button>}
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

      {!error && parties === null && <PartiesTableSkeleton canSeeMoney={canSeeMoney} />}

      {!error && parties !== null && parties.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No parties yet</p>
          <p className="text-sm text-muted-foreground">Clients you add will show up here.</p>
        </div>
      )}

      {!error && parties !== null && parties.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                {canSeeMoney && <TableHead className="text-right">Balance</TableHead>}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((party) => (
                <TableRow key={party.id}>
                  <TableCell>
                    <Link href={`/parties/${party.id}`} className="font-medium text-foreground hover:underline">
                      {party.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{party.contact_person ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{party.phone ?? "—"}</TableCell>
                  {canSeeMoney && (
                    <TableCell className="text-right tabular-nums">
                      {party.current_balance !== null && party.current_balance !== undefined
                        ? Number(party.current_balance).toFixed(2)
                        : "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={party.is_active ? "success" : "secondary"}>
                      {party.is_active ? "Active" : "Inactive"}
                    </Badge>
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

function PartiesTableSkeleton({ canSeeMoney }: { canSeeMoney: boolean }) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business Name</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Phone</TableHead>
            {canSeeMoney && <TableHead className="text-right">Balance</TableHead>}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              {canSeeMoney && (
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
              )}
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
