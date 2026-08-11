"use client";

import { useEffect, useState } from "react";

import { createFactory, getFactory } from "@embroidery/types";
import type { FactoryCreateRequest, FactoryOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

interface CompanyStepProps {
  onNext: () => void;
}

export function CompanyStep({ onNext }: CompanyStepProps) {
  const [factory, setFactory] = useState<FactoryOut | null>(null);
  const [checked, setChecked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFactory()
      .then((data) => {
        if (!cancelled) setFactory(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!(err instanceof ApiError && err.status === 404)) {
          setLoadError("Could not check company setup status.");
        }
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    const body: FactoryCreateRequest = {
      name,
      legal_name: legalName || undefined,
      phone: phone || undefined,
      email: email || undefined,
    };
    try {
      const created = await createFactory(body);
      setFactory(created);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!checked) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  if (factory) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Company</h2>
          <p className="text-sm text-gray-500">Your company is already set up.</p>
        </div>
        <div className="space-y-1 rounded bg-white p-4 text-sm shadow">
          <p className="font-medium">{factory.name}</p>
          {factory.legal_name && <p className="text-gray-500">{factory.legal_name}</p>}
          {factory.phone && <p className="text-gray-500">{factory.phone}</p>}
          {factory.email && <p className="text-gray-500">{factory.email}</p>}
        </div>
        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button onClick={onNext} className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Company</h2>
        <p className="text-sm text-gray-500">Tell us about your company.</p>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Company name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Legal name</label>
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="submit"
            disabled={submitting || !name}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving..." : "Save and continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
