"use client";

import { useCallback, useEffect, useState, use } from "react";

import { AlertCircle, Loader2, Printer } from "lucide-react";

import { getDeliveryChallan, listParties } from "@embroidery/types";
import type { DeliveryChallanDetailOut } from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";
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

const UNIT_LABELS: Record<string, string> = {
  shirt: "Shirt",
  dupatta: "Dupatta",
  trouser: "Trouser",
};

export default function DeliveryChallanDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [challan, setChallan] = useState<DeliveryChallanDetailOut | null>(null);
  const [partyName, setPartyName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setChallan(null);
    Promise.all([getDeliveryChallan(params.id), listParties()])
      .then(([challanData, parties]) => {
        setChallan(challanData);
        setPartyName(parties.find((p) => p.id === challanData.party_id)?.name ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Delivery challan not found.");
        } else {
          setError("Could not load delivery challan.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = async () => {
    if (!challan) return;
    setPrintError(null);
    setPrinting(true);
    try {
      const blob = await fetchPdfBlob(`/delivery-challans/${challan.id}/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setPrintError("Could not generate the PDF. Please try again.");
    } finally {
      setPrinting(false);
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

  if (challan === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{challan.challan_number}</h1>
          <p className="text-sm text-muted-foreground">
            {partyName ?? "—"} &middot; delivered {challan.delivery_date}
          </p>
          {challan.notes && <p className="mt-1 text-sm text-muted-foreground">{challan.notes}</p>}
        </div>
        <div className="text-right">
          <Button onClick={handlePrint} disabled={printing}>
            {printing ? <Loader2 className="animate-spin" /> : <Printer />}
            {printing ? "Generating..." : "Print"}
          </Button>
          {printError && <p className="mt-1 text-xs text-destructive">{printError}</p>}
        </div>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lot #</TableHead>
              <TableHead>Colour</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {challan.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.lot_number}</TableCell>
                <TableCell className="text-muted-foreground">{line.colour_name}</TableCell>
                <TableCell className="text-muted-foreground">{UNIT_LABELS[line.unit_type] ?? line.unit_type}</TableCell>
                <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
