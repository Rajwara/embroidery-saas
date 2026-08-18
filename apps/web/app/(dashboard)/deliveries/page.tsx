"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Truck } from "lucide-react";

import { listDeliveryChallans, listParties } from "@embroidery/types";
import type { DeliveryChallanOut, Party } from "@embroidery/types";

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

export default function DeliveryChallansPage() {
  const { hasPermission } = useAuth();
  const [challans, setChallans] = useState<DeliveryChallanOut[] | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setChallans(null);
    Promise.all([listDeliveryChallans(), listParties()])
      .then(([challansData, partiesData]) => {
        setChallans(challansData);
        setParties(partiesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view delivery challans.");
        } else {
          setError("Could not load delivery challans.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Delivery Challans</h1>
        {hasPermission("delivery_challans.create") && (
          <Button render={<Link href="/deliveries/new" />}>New Challan</Button>
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

      {!error && challans === null && <ChallansTableSkeleton />}

      {!error && challans !== null && challans.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Truck className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No delivery challans yet</p>
          <p className="text-sm text-muted-foreground">Challans you create will show up here.</p>
        </div>
      )}

      {!error && challans !== null && challans.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Challan #</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challans.map((challan) => (
                <TableRow key={challan.id}>
                  <TableCell>
                    <Link href={`/deliveries/${challan.id}`} className="font-medium text-foreground hover:underline">
                      {challan.challan_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{partyName(challan.party_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{challan.delivery_date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ChallansTableSkeleton() {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Challan #</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
