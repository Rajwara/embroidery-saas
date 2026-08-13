"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createPayment, getInvoiceBalances, listBranches, listParties } from "@embroidery/types";
import type { BranchOut, InvoiceBalanceOut, Party, PaymentAllocationCreateRequest } from "@embroidery/types";

import { ApiError } from "@/lib/api";

type OtherType = "general" | "advance" | "unallocated";

interface OtherAllocation {
  key: string;
  type: OtherType;
  amount: string;
}

const METHOD_OPTIONS: { value: "cash" | "bank_transfer" | "cheque" | "other"; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const OTHER_TYPE_OPTIONS: { value: OtherType; label: string }[] = [
  { value: "general", label: "General (against balance)" },
  { value: "advance", label: "Advance" },
  { value: "unallocated", label: "Unallocated" },
];

export default function NewPaymentPage() {
  const router = useRouter();

  const [parties, setParties] = useState<Party[]>([]);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [partyId, setPartyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "cheque" | "other">("cash");
  const [notes, setNotes] = useState("");

  const [balances, setBalances] = useState<InvoiceBalanceOut[] | null>(null);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [invoiceAllocations, setInvoiceAllocations] = useState<Record<string, string>>({});
  const [otherAllocations, setOtherAllocations] = useState<OtherAllocation[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listParties(), listBranches()])
      .then(([partiesData, branchesData]) => {
        setParties(partiesData);
        setBranches(branchesData);
      })
      .catch(() => setLoadError("Could not load parties/branches."));
  }, []);

  const handlePartyChange = (value: string) => {
    setPartyId(value);
    setBalances(null);
    setBalancesError(null);
    setInvoiceAllocations({});
    if (!value) return;
    getInvoiceBalances({ party_id: value })
      .then((rows) => setBalances(rows.filter((row) => row.balance > 0)))
      .catch(() => setBalancesError("Could not load outstanding invoices for this party."));
  };

  const addOtherAllocation = () => {
    setOtherAllocations((prev) => [...prev, { key: crypto.randomUUID(), type: "unallocated", amount: "" }]);
  };

  const updateOtherAllocation = (key: string, patch: Partial<OtherAllocation>) => {
    setOtherAllocations((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeOtherAllocation = (key: string) => {
    setOtherAllocations((prev) => prev.filter((row) => row.key !== key));
  };

  const allocatedTotal =
    Object.values(invoiceAllocations).reduce((sum, v) => sum + (Number(v) || 0), 0) +
    otherAllocations.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const amountNumber = Number(amount) || 0;
  const remaining = Math.round((amountNumber - allocatedTotal) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (remaining !== 0) {
      setSubmitError(`Allocations must sum exactly to the payment amount (${remaining > 0 ? "short" : "over"} by ${Math.abs(remaining).toFixed(2)}).`);
      return;
    }

    const allocations: PaymentAllocationCreateRequest[] = [
      ...Object.entries(invoiceAllocations)
        .filter(([, v]) => Number(v) > 0)
        .map(([invoiceId, v]) => ({
          allocation_type: "invoice" as const,
          invoice_id: invoiceId,
          amount: Number(v),
        })),
      ...otherAllocations
        .filter((row) => Number(row.amount) > 0)
        .map((row) => ({ allocation_type: row.type, amount: Number(row.amount) })),
    ];

    if (allocations.length === 0) {
      setSubmitError("Enter at least one allocation.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPayment({
        branch_id: branchId,
        party_id: partyId,
        payment_date: paymentDate,
        amount: amountNumber,
        payment_method: paymentMethod,
        notes: notes || undefined,
        allocations,
      });
      router.push(`/payments/${created.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">New Payment</h1>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-6 shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Party</label>
            <select
              value={partyId}
              onChange={(e) => handlePartyChange(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a party
              </option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a branch
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount received</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {partyId && (
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold">Allocate to outstanding invoices</h2>
            {balancesError && <p className="text-sm text-red-600">{balancesError}</p>}
            {!balancesError && balances === null && <p className="text-sm text-gray-500">Loading...</p>}
            {!balancesError && balances !== null && balances.length === 0 && (
              <p className="text-sm text-gray-500">No outstanding invoices for this party.</p>
            )}
            {!balancesError && balances !== null && balances.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-1 pr-2 font-medium">Invoice #</th>
                    <th className="py-1 pr-2 font-medium">Balance</th>
                    <th className="py-1 font-medium">Allocate</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((row) => (
                    <tr key={row.invoice_id} className="border-b border-gray-100 last:border-0">
                      <td className="py-1 pr-2">{row.invoice_number}</td>
                      <td className="py-1 pr-2">{row.balance.toFixed(2)}</td>
                      <td className="py-1">
                        <input
                          type="number"
                          min={0}
                          max={row.balance}
                          step="0.01"
                          value={invoiceAllocations[row.invoice_id] ?? ""}
                          onChange={(e) =>
                            setInvoiceAllocations((prev) => ({ ...prev, [row.invoice_id]: e.target.value }))
                          }
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold">Other allocations</h2>
          {otherAllocations.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <select
                value={row.type}
                onChange={(e) => updateOtherAllocation(row.key, { type: e.target.value as OtherType })}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {OTHER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Amount"
                value={row.amount}
                onChange={(e) => updateOtherAllocation(row.key, { amount: e.target.value })}
                className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeOtherAllocation(row.key)}
                className="text-xs font-medium text-red-600 underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOtherAllocation}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
          >
            + Add allocation
          </button>
        </div>

        <div className="border-t border-gray-100 pt-4 text-sm">
          <span className="font-medium">Remaining to allocate: </span>
          <span className={remaining === 0 ? "text-green-700" : "text-red-600"}>{remaining.toFixed(2)}</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="submit"
            disabled={submitting || !partyId || !branchId || !amount || remaining !== 0}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Recording..." : "Record payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
