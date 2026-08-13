"use client";

import { useCallback, useEffect, useState } from "react";

import { createBranch, listBranches, updateBranch } from "@embroidery/types";
import type { BranchOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function BranchesPage() {
  const { hasPermission } = useAuth();
  const [branches, setBranches] = useState<BranchOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [isHeadOffice, setIsHeadOffice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setBranches(null);
    listBranches()
      .then(setBranches)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view branches.");
        } else {
          setError("Could not load branches.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createBranch({
        name,
        code,
        address: address || undefined,
        city: city || undefined,
        phone: phone || undefined,
        is_head_office: isHeadOffice,
      });
      setName("");
      setCode("");
      setAddress("");
      setCity("");
      setPhone("");
      setIsHeadOffice(false);
      setShowCreate(false);
      load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (branch: BranchOut) => {
    setEditingId(branch.id);
    setEditName(branch.name);
    setEditCity(branch.city ?? "");
    setEditIsActive(branch.is_active);
  };

  const saveEdit = async (branchId: string) => {
    setEditSaving(true);
    try {
      await updateBranch(branchId, { name: editName, city: editCity || undefined, is_active: editIsActive });
      setEditingId(null);
      load();
    } catch {
      // leave the row in edit mode so the user can retry
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Branches</h1>
        {hasPermission("branches.create") && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            {showCreate ? "Cancel" : "New Branch"}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="max-w-md space-y-4 rounded bg-white p-6 shadow">
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
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
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isHeadOffice} onChange={(e) => setIsHeadOffice(e.target.checked)} />
            Head office
          </label>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={submitting || !name || !code}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Creating..." : "Create branch"}
            </button>
          </div>
        </form>
      )}

      {!error && branches === null && <p className="text-sm text-gray-500">Loading branches...</p>}

      {!error && branches !== null && branches.length === 0 && (
        <p className="text-sm text-gray-500">No branches found.</p>
      )}

      {!error && branches !== null && branches.length > 0 && (
        <table className="w-full rounded bg-white text-sm shadow">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">City</th>
              <th className="px-4 py-2 font-medium">Head office</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id} className="border-b border-gray-100 last:border-0">
                {editingId === branch.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">{branch.code}</td>
                    <td className="px-4 py-2">
                      <input
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">{branch.is_head_office ? "Yes" : "No"}</td>
                    <td className="px-4 py-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                        />
                        Active
                      </label>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => saveEdit(branch.id)}
                          disabled={editSaving}
                          className="text-xs font-medium text-gray-900 underline disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs font-medium text-gray-500 underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2">{branch.name}</td>
                    <td className="px-4 py-2">{branch.code}</td>
                    <td className="px-4 py-2">{branch.city ?? "—"}</td>
                    <td className="px-4 py-2">{branch.is_head_office ? "Yes" : "No"}</td>
                    <td className="px-4 py-2">{branch.is_active ? "Active" : "Inactive"}</td>
                    <td className="px-4 py-2 text-right">
                      {hasPermission("branches.edit") && (
                        <button
                          onClick={() => startEdit(branch)}
                          className="text-xs font-medium text-gray-700 underline"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
