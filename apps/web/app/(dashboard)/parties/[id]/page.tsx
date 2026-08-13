"use client";

import { useCallback, useEffect, useState } from "react";

import { getParty, getPartyLedger } from "@embroidery/types";
import type { LedgerEntryOut, PartyDocsOut } from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const ENTRY_TYPE_LABELS: Record<string, string> = {
  opening_balance: "Opening Balance",
  invoice: "Invoice",
  payment: "Payment",
};

export default function PartyDetailPage({ params }: { params: { id: string } }) {
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
      <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>{error}</span>
        <button onClick={load} className="font-medium underline">
          Retry
        </button>
      </div>
    );
  }

  if (party === null) {
    return <p className="text-sm text-gray-500">Loading party...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{party.name}</h1>
          <p className="text-sm text-gray-500">
            {party.contact_person ?? "—"} &middot; {party.phone ?? "—"} &middot; {party.email ?? "—"}
          </p>
          {party.address && <p className="mt-1 text-sm text-gray-500">{party.address}</p>}
        </div>
        {canSeeMoney && (
          <div className="text-right">
            <button
              onClick={handlePrint}
              disabled={printing}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {printing ? "Generating..." : "Print statement"}
            </button>
            {printError && <p className="mt-1 text-xs text-red-600">{printError}</p>}
          </div>
        )}
      </div>

      {canSeeMoney && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Ledger</h2>
          {ledger === null && <p className="text-sm text-gray-500">Loading ledger...</p>}
          {ledger !== null && (
            <table className="w-full rounded bg-white text-sm shadow">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Reference</th>
                  <th className="px-4 py-2 font-medium">Debit</th>
                  <th className="px-4 py-2 font-medium">Credit</th>
                  <th className="px-4 py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2">{entry.entry_date}</td>
                    <td className="px-4 py-2">{ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}</td>
                    <td className="px-4 py-2">{entry.reference}</td>
                    <td className="px-4 py-2">{entry.debit ? entry.debit.toFixed(2) : ""}</td>
                    <td className="px-4 py-2">{entry.credit ? entry.credit.toFixed(2) : ""}</td>
                    <td className="px-4 py-2 font-medium">{entry.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
