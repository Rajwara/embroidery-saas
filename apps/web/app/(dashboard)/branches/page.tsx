"use client";

import { useCallback, useEffect, useState } from "react";

import { AlertCircle, Loader2 } from "lucide-react";

import { createBranch, listBranches, updateBranch } from "@embroidery/types";
import type { BranchOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
          <Button onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Cancel" : "New Branch"}</Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{error}</AlertTitle>
          <AlertDescription>
            <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={load}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="max-w-md space-y-4 rounded-xl border bg-card p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={isHeadOffice} onChange={(e) => setIsHeadOffice(e.target.checked)} />
            Head office
          </label>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={submitting || !name || !code}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? "Creating..." : "Create branch"}
            </Button>
          </div>
        </form>
      )}

      {!error && branches === null && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {!error && branches !== null && branches.length === 0 && (
        <p className="text-sm text-muted-foreground">No branches found.</p>
      )}

      {!error && branches !== null && branches.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Head office</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  {editingId === branch.id ? (
                    <>
                      <TableCell>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{branch.code}</TableCell>
                      <TableCell>
                        <input
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{branch.is_head_office ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)}
                          />
                          Active
                        </label>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-3">
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            onClick={() => saveEdit(branch.id)}
                            disabled={editSaving}
                          >
                            {editSaving && <Loader2 className="animate-spin" />}
                            Save
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-muted-foreground"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell className="text-muted-foreground">{branch.code}</TableCell>
                      <TableCell className="text-muted-foreground">{branch.city ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{branch.is_head_office ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <Badge variant={branch.is_active ? "success" : "secondary"}>
                          {branch.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {hasPermission("branches.edit") && (
                          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => startEdit(branch)}>
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
