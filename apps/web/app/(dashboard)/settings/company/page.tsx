"use client";

import { useCallback, useEffect, useState } from "react";

import { getFactory, updateFactory } from "@embroidery/types";
import type { FactoryOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CompanyProfileSettingsPage() {
  const [factory, setFactory] = useState<FactoryOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [currency, setCurrency] = useState("");
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState("1");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [lotPrefix, setLotPrefix] = useState("");
  const [challanPrefix, setChallanPrefix] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("");
  const [paymentPrefix, setPaymentPrefix] = useState("");
  const [purchasePrefix, setPurchasePrefix] = useState("");
  const [expensePrefix, setExpensePrefix] = useState("");
  const [numberingSubmitting, setNumberingSubmitting] = useState(false);
  const [numberingError, setNumberingError] = useState<string | null>(null);
  const [numberingSaved, setNumberingSaved] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setFactory(null);
    getFactory()
      .then((data) => {
        setFactory(data);
        setName(data.name);
        setLegalName(data.legal_name ?? "");
        setAddressLine1(data.address_line1 ?? "");
        setAddressLine2(data.address_line2 ?? "");
        setCity(data.city ?? "");
        setState(data.state ?? "");
        setPostalCode(data.postal_code ?? "");
        setCountry(data.country);
        setPhone(data.phone ?? "");
        setEmail(data.email ?? "");
        setTaxId(data.tax_id ?? "");
        setCurrency(data.currency);
        setFiscalYearStartMonth(String(data.fiscal_year_start_month));
        setLotPrefix(data.lot_number_prefix);
        setChallanPrefix(data.challan_number_prefix);
        setInvoicePrefix(data.invoice_number_prefix);
        setPaymentPrefix(data.payment_number_prefix);
        setPurchasePrefix(data.purchase_number_prefix);
        setExpensePrefix(data.expense_number_prefix);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view the company profile.");
        } else {
          setError("Could not load the company profile.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const updated = await updateFactory({
        name,
        legal_name: legalName || undefined,
        address_line1: addressLine1 || undefined,
        address_line2: addressLine2 || undefined,
        city: city || undefined,
        state: state || undefined,
        postal_code: postalCode || undefined,
        country: country || undefined,
        phone: phone || undefined,
        email: email || undefined,
        tax_id: taxId || undefined,
        currency: currency || undefined,
        fiscal_year_start_month: Number(fiscalYearStartMonth),
      });
      setFactory(updated);
      setSaved(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNumberingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNumberingError(null);
    setNumberingSaved(false);
    setNumberingSubmitting(true);
    try {
      const updated = await updateFactory({
        lot_number_prefix: lotPrefix,
        challan_number_prefix: challanPrefix,
        invoice_number_prefix: invoicePrefix,
        payment_number_prefix: paymentPrefix,
        purchase_number_prefix: purchasePrefix,
        expense_number_prefix: expensePrefix,
      });
      setFactory(updated);
      setNumberingSaved(true);
    } catch (err) {
      setNumberingError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setNumberingSubmitting(false);
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

  if (factory === null) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Company Profile</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-6 shadow">
        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Address line 1</label>
            <input
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Address line 2</label>
            <input
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">State</label>
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Postal code</label>
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Country</label>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tax ID</label>
            <input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Currency</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fiscal year start</label>
            <select
              value={fiscalYearStartMonth}
              onChange={(e) => setFiscalYearStartMonth(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {MONTH_NAMES.map((monthName, idx) => (
                <option key={monthName} value={idx + 1}>
                  {monthName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        {saved && !submitError && <p className="text-sm text-green-700">Saved.</p>}

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="submit"
            disabled={submitting || !name}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>

      <div className="space-y-4 rounded bg-white p-6 shadow">
        <div>
          <h2 className="text-lg font-semibold">Document Numbering</h2>
          <p className="text-sm text-gray-500">
            Prefixes are editable; the numbers themselves are system-managed and can&apos;t be reset, to
            avoid ever reusing a number already issued.
          </p>
        </div>

        <form onSubmit={handleNumberingSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Lot prefix</label>
              <input
                value={lotPrefix}
                onChange={(e) => setLotPrefix(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Next: {lotPrefix}-{String(factory.next_lot_number).padStart(6, "0")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Delivery challan prefix</label>
              <input
                value={challanPrefix}
                onChange={(e) => setChallanPrefix(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Next: {challanPrefix}-{String(factory.next_challan_number).padStart(6, "0")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Invoice prefix</label>
              <input
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Next: {invoicePrefix}-{String(factory.next_invoice_number).padStart(6, "0")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Payment prefix</label>
              <input
                value={paymentPrefix}
                onChange={(e) => setPaymentPrefix(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Next: {paymentPrefix}-{String(factory.next_payment_number).padStart(6, "0")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Purchase prefix</label>
              <input
                value={purchasePrefix}
                onChange={(e) => setPurchasePrefix(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Next: {purchasePrefix}-{String(factory.next_purchase_number).padStart(6, "0")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Expense prefix</label>
              <input
                value={expensePrefix}
                onChange={(e) => setExpensePrefix(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Next: {expensePrefix}-{String(factory.next_expense_number).padStart(6, "0")}</p>
            </div>
          </div>

          {numberingError && <p className="text-sm text-red-600">{numberingError}</p>}
          {numberingSaved && !numberingError && <p className="text-sm text-green-700">Saved.</p>}

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={numberingSubmitting}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {numberingSubmitting ? "Saving..." : "Save prefixes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
