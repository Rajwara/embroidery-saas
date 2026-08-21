"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createInvoice, getDesign, listBranches, listDesigns, listParties } from "@embroidery/types";
import type { BranchOut, DesignOut, DesignVariantOut, Party } from "@embroidery/types";

import { ApiError } from "@/lib/api";

type PricingType = "per_suit" | "stitch_based";

interface LineDraft {
  key: string;
  description: string;
  pricingType: PricingType;
  quantity: string;
  unitPrice: string;
  designId: string;
  designVariantId: string;
  ratePerThousandStitches: string;
}

function emptyLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    description: "",
    pricingType: "per_suit",
    quantity: "",
    unitPrice: "",
    designId: "",
    designVariantId: "",
    ratePerThousandStitches: "",
  };
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={null}>
      <NewInvoiceForm />
    </Suspense>
  );
}

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lockedPartyId = searchParams.get("party_id");

  const [parties, setParties] = useState<Party[]>([]);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [designs, setDesigns] = useState<DesignOut[]>([]);
  const [variantsByDesign, setVariantsByDesign] = useState<Record<string, DesignVariantOut[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const [partyId, setPartyId] = useState(lockedPartyId ?? "");
  const [branchId, setBranchId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listParties(), listBranches(), listDesigns()])
      .then(([partiesData, branchesData, designsData]) => {
        setParties(partiesData);
        setBranches(branchesData);
        setDesigns(designsData);
      })
      .catch(() => setLoadError("Could not load parties/branches/designs."));
  }, []);

  const loadVariants = (designId: string) => {
    if (!designId || variantsByDesign[designId]) return;
    getDesign(designId).then((detail) => {
      setVariantsByDesign((prev) => ({ ...prev, [designId]: detail.variants }));
    });
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((line) => line.key !== key));
  };

  const selectedVariant = (line: LineDraft): DesignVariantOut | undefined =>
    variantsByDesign[line.designId]?.find((v) => v.id === line.designVariantId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const payloadLines = lines.map((line) => {
      if (line.pricingType === "per_suit") {
        return {
          description: line.description,
          pricing_type: "per_suit" as const,
          quantity: Number(line.quantity),
          unit_price: Number(line.unitPrice),
        };
      }
      return {
        description: line.description,
        pricing_type: "stitch_based" as const,
        quantity: Number(line.quantity),
        design_variant_id: line.designVariantId,
        rate_per_thousand_stitches: Number(line.ratePerThousandStitches),
      };
    });

    setSubmitting(true);
    try {
      const created = await createInvoice({
        branch_id: branchId,
        party_id: partyId,
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        lines: payloadLines,
      });
      router.push(`/invoices/${created.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const canSubmit =
    partyId &&
    branchId &&
    lines.length > 0 &&
    lines.every((line) => {
      if (!line.description || !line.quantity) return false;
      if (line.pricingType === "per_suit") return !!line.unitPrice;
      return !!line.designVariantId && !!line.ratePerThousandStitches;
    });

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">New Invoice</h1>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-6 shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Party</label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              required
              disabled={!!lockedPartyId}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Invoice date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Due date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold">Line items</h2>
          {lines.map((line) => (
            <div key={line.key} className="space-y-2 rounded border border-gray-200 p-3">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => updateLine(line.key, { description: e.target.value })}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <select
                  value={line.pricingType}
                  onChange={(e) => updateLine(line.key, { pricingType: e.target.value as PricingType })}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="per_suit">Per suit</option>
                  <option value="stitch_based">Stitch-based</option>
                </select>
              </div>

              {line.pricingType === "per_suit" ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="Quantity"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Unit price"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="Quantity"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Rate per 1000 stitches"
                    value={line.ratePerThousandStitches}
                    onChange={(e) => updateLine(line.key, { ratePerThousandStitches: e.target.value })}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={line.designId}
                    onChange={(e) => {
                      updateLine(line.key, { designId: e.target.value, designVariantId: "" });
                      loadVariants(e.target.value);
                    }}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select design</option>
                    {designs.map((design) => (
                      <option key={design.id} value={design.id}>
                        {design.master_number} &middot; {design.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={line.designVariantId}
                    onChange={(e) => updateLine(line.key, { designVariantId: e.target.value })}
                    disabled={!line.designId}
                    className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-40"
                  >
                    <option value="">Select variant</option>
                    {(variantsByDesign[line.designId] ?? []).map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.variant_code} ({variant.stitch_count ?? "no stitch count"})
                      </option>
                    ))}
                  </select>
                  {line.designVariantId && selectedVariant(line)?.stitch_count == null && (
                    <p className="col-span-2 text-xs text-red-600">
                      This variant has no stitch count set yet -- set it from the Design page first.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length === 1}
                  className="text-xs font-medium text-red-600 underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove line
                </button>
              </div>
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
            {submitting ? "Creating..." : "Create invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
