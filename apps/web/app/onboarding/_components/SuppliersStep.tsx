"use client";

import { useState } from "react";

import { createSupplier, listSuppliers } from "@embroidery/types";
import type { Supplier, SupplierCreateRequest } from "@embroidery/types";

import { EntityAddStep } from "./EntityAddStep";

interface SuppliersStepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function SuppliersStep({ onNext, onBack }: SuppliersStepProps) {
  return (
    <EntityAddStep<Supplier, SupplierCreateRequest>
      title="Suppliers"
      description="Add the suppliers you buy materials from. You can skip this and add them later."
      list={() => listSuppliers()}
      create={createSupplier}
      emptyLabel="No suppliers added yet."
      onBack={onBack}
      onNext={onNext}
      nextLabel="Finish"
      renderItem={(supplier) => (
        <span>
          <span className="font-medium">{supplier.name}</span>
          {supplier.contact_person && <span className="text-gray-500"> — {supplier.contact_person}</span>}
        </span>
      )}
      renderForm={({ add, submitting, submitError }) => (
        <SupplierForm add={add} submitting={submitting} submitError={submitError} />
      )}
    />
  );
}

interface SupplierFormProps {
  add: (body: SupplierCreateRequest) => Promise<unknown>;
  submitting: boolean;
  submitError: string | null;
}

function SupplierForm({ add, submitting, submitError }: SupplierFormProps) {
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await add({
        name,
        contact_person: contactPerson || undefined,
        phone: phone || undefined,
        opening_balance: openingBalance || undefined,
      });
      setName("");
      setContactPerson("");
      setPhone("");
      setOpeningBalance("");
    } catch {
      // surfaced via submitError
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded bg-white p-4 shadow">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Contact person</label>
          <input
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Opening balance</label>
          <input
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <button
        type="submit"
        disabled={submitting || !name}
        className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Adding..." : "Add supplier"}
      </button>
    </form>
  );
}
