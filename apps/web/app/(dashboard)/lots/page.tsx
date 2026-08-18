"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Package } from "lucide-react";

import { listBranches, listLots, listParties } from "@embroidery/types";
import type { BranchOut, LotOut, Party } from "@embroidery/types";

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

const SUIT_TYPE_LABELS: Record<string, string> = {
  one_piece: "One-piece",
  two_piece: "Two-piece",
  three_piece: "Three-piece",
};

export default function LotsPage() {
  const { hasPermission } = useAuth();
  const [lots, setLots] = useState<LotOut[] | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLots(null);
    Promise.all([listLots(), listParties(), listBranches()])
      .then(([lotsData, partiesData, branchesData]) => {
        setLots(lotsData);
        setParties(partiesData);
        setBranches(branchesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view lots.");
        } else {
          setError("Could not load lots.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? "—";
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lots</h1>
        {hasPermission("lots.create") && <Button render={<Link href="/lots/new" />}>New Lot</Button>}
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

      {!error && lots === null && <LotsTableSkeleton />}

      {!error && lots !== null && lots.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Package className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No lots yet</p>
          <p className="text-sm text-muted-foreground">Lots you receive will show up here.</p>
        </div>
      )}

      {!error && lots !== null && lots.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot #</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Suit type</TableHead>
                <TableHead className="text-right">Suits</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((lot) => (
                <TableRow key={lot.id}>
                  <TableCell>
                    <Link href={`/lots/${lot.id}`} className="font-medium text-foreground hover:underline">
                      {lot.lot_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{partyName(lot.party_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{branchName(lot.branch_id)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {SUIT_TYPE_LABELS[lot.suit_type] ?? lot.suit_type}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{lot.total_suit_count}</TableCell>
                  <TableCell className="text-muted-foreground">{lot.received_date}</TableCell>
                  <TableCell>
                    <StatusBadge status={lot.status} />
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

function LotsTableSkeleton() {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lot #</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Suit type</TableHead>
            <TableHead className="text-right">Suits</TableHead>
            <TableHead>Received</TableHead>
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
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-24 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
