"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createPurchase, listBranches, listSuppliers } from "@embroidery/types";
import type { BranchOut, Supplier } from "@embroidery/types";

import { ApiError } from "@/lib/api";

interface LineDraft {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function emptyLine(): LineDraft {
  return { key: crypto.randomUUID(), description: "", quantity: "", unitPrice: "" };
}

export default function NewPurchasePage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listSuppliers(), listBranches()])
      .then(([suppliersData, branchesData]) => {
        setSuppliers(suppliersData);
        setBranches(branchesData);
      })
      .catch(() => setLoadError("Could not load suppliers/branches."));
  }, []);

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((line) => line.key !== key));
  };

  const canSubmit =
    supplierId &&
    branchId &&
    lines.length > 0 &&
    lines.every((line) => line.description && line.quantity && line.unitPrice);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createPurchase({
        branch_id: branchId,
        supplier_id: supplierId,
        purchase_date: purchaseDate,
        notes: notes || undefined,
        lines: lines.map((line) => ({
          description: line.description,
          quantity: Number(line.quantity),
          unit_price: Number(line.unitPrice),
        })),
      });
      router.push(`/purchases/${created.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">New Purchase</h1>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-6 shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Supplier</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a supplier
              </option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
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

        <div>
          <label className="block text-sm font-medium text-gray-700">Purchase date</label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            required
            className="mt-1 w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold">Line items</h2>
          {lines.map((line) => (
            <div key={line.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
              <input
                type="text"
                placeholder="Description"
                value={line.description}
                onChange={(e) => updateLine(line.key, { description: e.target.value })}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={1}
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Unit price"
                value={line.unitPrice}
                onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                className="w-28 rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                disabled={lines.length === 1}
                className="text-xs font-medium text-red-600 underline disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
          >
            + Add line
          </button>
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
            disabled={submitting || !canSubmit}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creating..." : "Create purchase"}
          </button>
        </div>
      </form>
    </div>
  );
}
