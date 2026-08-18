"use client";

import { useCallback, useEffect, useState, use } from "react";

import { AlertCircle, Loader2, Printer, Receipt } from "lucide-react";

import { getParty, getPartyLedger } from "@embroidery/types";
import type { LedgerEntryOut, PartyDocsOut } from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ENTRY_TYPE_LABELS: Record<string, string> = {
  opening_balance: "Opening Balance",
  invoice: "Invoice",
  payment: "Payment",
};

const ENTRY_TYPE_BADGE_VARIANT: Record<string, "default" | "secondary" | "success"> = {
  opening_balance: "secondary",
  invoice: "default",
  payment: "success",
};

export default function PartyDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { hasPermission } = useAuth();
  const canSeeMoney = hasPermission("parties.see_money");

  const [party, setParty] = useState<PartyDocsOut | null>(null);
  const [ledger, setLedger] = useState<LedgerEntryOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setParty(null);
    setLedger(null);
    const requests: [Promise<PartyDocsOut>, Promise<LedgerEntryOut[]> | Promise<null>] = [
      getParty(params.id),
      canSeeMoney ? getPartyLedger(params.id) : Promise.resolve(null),
    ];
    Promise.all(requests)
      .then(([partyData, ledgerData]) => {
        setParty(partyData);
        setLedger(ledgerData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Party not found.");
        } else {
          setError("Could not load party.");
        }
      });
  }, [params.id, canSeeMoney]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = async () => {
    setPrintError(null);
    setPrinting(true);
    try {
      const blob = await fetchPdfBlob(`/parties/${params.id}/ledger/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setPrintError("Could not generate the statement. Please try again.");
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

  if (party === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{party.name}</h1>
          <p className="text-sm text-muted-foreground">
            {party.contact_person ?? "—"} &middot; {party.phone ?? "—"} &middot; {party.email ?? "—"}
          </p>
          {party.address && <p className="mt-1 text-sm text-muted-foreground">{party.address}</p>}
        </div>
        {canSeeMoney && (
          <div className="text-right">
            <Button onClick={handlePrint} disabled={printing}>
              {printing ? <Loader2 className="animate-spin" /> : <Printer />}
              {printing ? "Generating..." : "Print statement"}
            </Button>
            {printError && <p className="mt-1 text-xs text-destructive">{printError}</p>}
          </div>
        )}
      </div>

      {canSeeMoney && (
        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {ledger === null && <LedgerSkeleton />}

            {ledger !== null && ledger.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Receipt className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">No transactions yet</p>
                <p className="text-sm text-muted-foreground">Invoices and payments will show up here.</p>
              </div>
            )}

            {ledger !== null && ledger.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{entry.entry_date}</TableCell>
                      <TableCell>
                        <Badge variant={ENTRY_TYPE_BADGE_VARIANT[entry.entry_type] ?? "secondary"}>
                          {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.reference}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.debit ? entry.debit.toFixed(2) : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.credit ? entry.credit.toFixed(2) : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {entry.balance.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LedgerSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
