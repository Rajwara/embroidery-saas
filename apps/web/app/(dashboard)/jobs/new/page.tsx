"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createProductionJob, getLot, listDesigns, listLots, listProductionJobs } from "@embroidery/types";
import type { DesignOut, LotColourWithComponentsOut, LotOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

export default function NewProductionJobPage() {
  const router = useRouter();

  const [confirmedLots, setConfirmedLots] = useState<LotOut[]>([]);
  const [designs, setDesigns] = useState<DesignOut[]>([]);
  const [jobbedColourIds, setJobbedColourIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  const [lotId, setLotId] = useState("");
  const [lotColours, setLotColours] = useState<LotColourWithComponentsOut[] | null>(null);
  const [colourLoadError, setColourLoadError] = useState<string | null>(null);

  const [colourId, setColourId] = useState("");
  const [designId, setDesignId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listLots({ status: "confirmed" }), listDesigns(), listProductionJobs()])
      .then(([lotsData, designsData, jobsData]) => {
        setConfirmedLots(lotsData);
        setDesigns(designsData);
        setJobbedColourIds(new Set(jobsData.map((job) => job.lot_colour_id)));
      })
      .catch(() => setLoadError("Could not load lots/designs."));
  }, []);

  const loadColours = useCallback((selectedLotId: string) => {
    setColourLoadError(null);
    setLotColours(null);
    setColourId("");
    if (!selectedLotId) return;
    getLot(selectedLotId)
      .then((lot) => setLotColours(lot.colours))
      .catch(() => setColourLoadError("Could not load this lot's colours."));
  }, []);

  const handleLotChange = (value: string) => {
    setLotId(value);
    loadColours(value);
  };

  const availableColours = useMemo(
    () => (lotColours ?? []).filter((colour) => !jobbedColourIds.has(colour.id)),
    [lotColours, jobbedColourIds],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createProductionJob({ lot_colour_id: colourId, design_id: designId });
      router.push(`/jobs/${created.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">New Production Job</h1>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-6 shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700">Confirmed lot</label>
          <select
            value={lotId}
            onChange={(e) => handleLotChange(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select a confirmed lot
            </option>
            {confirmedLots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.lot_number}
              </option>
            ))}
          </select>
          {confirmedLots.length === 0 && !loadError && (
            <p className="mt-1 text-xs text-gray-500">No confirmed lots yet.</p>
          )}
        </div>

        {lotId && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Colour</label>
            {colourLoadError && <p className="text-sm text-red-600">{colourLoadError}</p>}
            {!colourLoadError && lotColours === null && (
              <p className="text-sm text-gray-500">Loading colours...</p>
            )}
            {!colourLoadError && lotColours !== null && (
              <select
                value={colourId}
                onChange={(e) => setColourId(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select a colour
                </option>
                {availableColours.map((colour) => (
                  <option key={colour.id} value={colour.id}>
                    {colour.colour_name} ({colour.suit_count} suits)
                  </option>
                ))}
              </select>
            )}
            {!colourLoadError && lotColours !== null && availableColours.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Every colour in this lot already has a production job.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Design</label>
          <select
            value={designId}
            onChange={(e) => setDesignId(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select a design
            </option>
            {designs.map((design) => (
              <option key={design.id} value={design.id}>
                {design.master_number} &middot; {design.name}
              </option>
            ))}
          </select>
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="submit"
            disabled={submitting || !colourId || !designId}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creating..." : "Create job"}
          </button>
        </div>
      </form>
    </div>
  );
}
