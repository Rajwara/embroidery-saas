"use client";

import { useCallback, useEffect, useState, use } from "react";

import { addDesignVariant, getDesign, removeDesignVariant } from "@embroidery/types";
import type { DesignDetailOut, DesignVariantCreateRequest, DesignVariantOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const COMPONENT_OPTIONS: { value: DesignVariantCreateRequest["component_type"]; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "sleeves", label: "Sleeves" },
  { value: "trouser", label: "Trouser" },
  { value: "dupatta", label: "Dupatta" },
];

const COMPONENT_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  sleeves: "Sleeves",
  trouser: "Trouser",
  dupatta: "Dupatta",
};

export default function DesignDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [design, setDesign] = useState<DesignDetailOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setDesign(null);
    getDesign(params.id)
      .then(setDesign)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Design not found.");
        } else {
          setError("Could not load design.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVariantAdded = (variant: DesignVariantOut) => {
    setDesign((prev) => (prev ? { ...prev, variants: [...prev.variants, variant] } : prev));
  };

  const handleVariantRemoved = (variantId: string) => {
    setDesign((prev) => (prev ? { ...prev, variants: prev.variants.filter((v) => v.id !== variantId) } : prev));
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

  if (design === null) {
    return <p className="text-sm text-gray-500">Loading design...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{design.master_number}</h1>
        <p className="text-sm text-gray-500">{design.name}</p>
        {design.notes && <p className="mt-1 text-sm text-gray-500">{design.notes}</p>}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Component &amp; colour-scheme variants</h2>

        {design.variants.length === 0 ? (
          <p className="text-sm text-gray-500">No variants added yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded bg-white shadow">
            {design.variants.map((variant) => (
              <VariantRow
                key={variant.id}
                designId={design.id}
                variant={variant}
                onRemoved={() => handleVariantRemoved(variant.id)}
              />
            ))}
          </ul>
        )}

        <AddVariantForm designId={design.id} onAdded={handleVariantAdded} />
      </div>
    </div>
  );
}

interface VariantRowProps {
  designId: string;
  variant: DesignVariantOut;
  onRemoved: () => void;
}

function VariantRow({ designId, variant, onRemoved }: VariantRowProps) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeDesignVariant(designId, variant.id);
      onRemoved();
    } catch {
      setRemoving(false);
    }
  };

  return (
    <li className="flex items-center justify-between px-4 py-2 text-sm">
      <span>
        <span className="font-medium">{variant.variant_code}</span>{" "}
        <span className="text-gray-500">
          — {COMPONENT_LABELS[variant.component_type] ?? variant.component_type} · {variant.colour_variant_code}
        </span>
      </span>
      <button
        onClick={handleRemove}
        disabled={removing}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
      >
        {removing ? "Removing..." : "Remove"}
      </button>
    </li>
  );
}

interface AddVariantFormProps {
  designId: string;
  onAdded: (variant: DesignVariantOut) => void;
}

function AddVariantForm({ designId, onAdded }: AddVariantFormProps) {
  const [componentType, setComponentType] = useState<DesignVariantCreateRequest["component_type"]>("front");
  const [colourVariantCode, setColourVariantCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await addDesignVariant(designId, {
        component_type: componentType,
        colour_variant_code: colourVariantCode,
      });
      onAdded(created);
      setColourVariantCode("");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 rounded bg-white p-4 shadow">
      <div className="w-40">
        <label className="block text-sm font-medium text-gray-700">Component</label>
        <select
          value={componentType}
          onChange={(e) => setComponentType(e.target.value as DesignVariantCreateRequest["component_type"])}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {COMPONENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700">Colour variant code</label>
        <input
          value={colourVariantCode}
          onChange={(e) => setColourVariantCode(e.target.value)}
          required
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !colourVariantCode}
        className="rounded bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Adding..." : "Add variant"}
      </button>
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
    </form>
  );
}
