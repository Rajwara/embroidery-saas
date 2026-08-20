"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AlertCircle, Loader2 } from "lucide-react";

import {
  getMachine,
  getMachineStatusBoard,
  getMachineStatusHistory,
  listEmployees,
  listLots,
  listParties,
  setMachineAssignment,
  updateMachine,
} from "@embroidery/types";
import type {
  EmployeeOut,
  LotOut,
  MachineOut,
  MachineStatusHistoryOut,
  MachineStatusOut,
  PartyDocsOut,
} from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Morning",
  evening: "Evening",
  night: "Night",
};

const LIGHT_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  maintenance: "bg-amber-500",
  out_of_order: "bg-orange-600",
  idle: "bg-rose-400",
};

const LIGHT_LABEL: Record<string, string> = {
  active: "Actively worked on",
  maintenance: "Under maintenance",
  out_of_order: "Out of order",
  idle: "Idle -- not in use today",
};

const LIGHT_MESSAGE: Record<string, string> = {
  maintenance: "No production is scheduled while this machine is being serviced.",
  out_of_order: "This machine is out of order and unavailable for production.",
  idle: "Nothing is currently assigned to this machine.",
};

const STATUS_OPTIONS = ["active", "maintenance", "out_of_order"] as const;

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  maintenance: "Maintenance",
  out_of_order: "Out of Order",
};

const MACHINE_PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(`
    <svg width="800" height="300" viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="150" fill="#eef0f3"/>
      <g fill="none" stroke="#9aa1ab" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="140" y="55" width="120" height="50" rx="8"/>
        <rect x="163" y="30" width="30" height="30" rx="5"/>
        <line x1="178" y1="30" x2="178" y2="14"/>
        <circle cx="178" cy="10" r="4"/>
        <line x1="158" y1="105" x2="158" y2="122"/>
        <line x1="242" y1="105" x2="242" y2="122"/>
        <circle cx="200" cy="80" r="14"/>
      </g>
    </svg>
  `.trim());

interface EditState {
  name: string;
  machine_type: string;
  number_of_heads: string;
  brand: string;
  model: string;
  purchase_date: string;
  notes: string;
  is_active: boolean;
}

function toEditState(m: MachineOut): EditState {
  return {
    name: m.name ?? "",
    machine_type: m.machine_type ?? "",
    number_of_heads: m.number_of_heads?.toString() ?? "",
    brand: m.brand ?? "",
    model: m.model ?? "",
    purchase_date: m.purchase_date ?? "",
    notes: m.notes ?? "",
    is_active: m.is_active,
  };
}

export default function MachineDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const searchParams = useSearchParams();

  const [machine, setMachine] = useState<MachineOut | null>(null);
  const [status, setStatus] = useState<MachineStatusOut | undefined>(undefined);
  const [history, setHistory] = useState<MachineStatusHistoryOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const [assigning, setAssigning] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOut[]>([]);
  const [lots, setLots] = useState<LotOut[]>([]);
  const [parties, setParties] = useState<PartyDocsOut[]>([]);
  const [assignShift, setAssignShift] = useState<"morning" | "evening" | "night">("morning");
  const [assignOperatorId, setAssignOperatorId] = useState("");
  const [assignHelperId, setAssignHelperId] = useState("");
  const [assignLotId, setAssignLotId] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [pendingActivate, setPendingActivate] = useState(false);

  const [pdfError, setPdfError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setMachine(null);
    Promise.all([getMachine(params.id), getMachineStatusBoard(), getMachineStatusHistory(params.id)])
      .then(([machineData, board, historyData]) => {
        setMachine(machineData);
        setStatus(board.find((s) => s.machine_id === machineData.id));
        setHistory(historyData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Machine not found.");
        } else if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view machines.");
        } else {
          setError("Could not load machine.");
        }
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openAssignPanel = useCallback(
    (activateOnSave: boolean) => {
      if (!machine) return;
      setAssignError(null);
      setAssignShift((machine.current_shift as "morning" | "evening" | "night") || "morning");
      setAssignOperatorId(machine.current_operator_employee_id ?? "");
      setAssignHelperId(machine.current_helper_employee_id ?? "");
      setAssignLotId(machine.current_lot_id ?? "");
      setPendingActivate(activateOnSave);
      setAssigning(true);
      Promise.all([listEmployees(), listLots(), listParties()])
        .then(([employeeData, lotData, partyData]) => {
          setEmployees(employeeData);
          setLots(lotData);
          setParties(partyData);
        })
        .catch(() => {});
    },
    [machine]
  );

  // A redirect from the Machines card (picking Active from a non-active
  // status there just sends you here, rather than duplicating this whole
  // flow in the compact card) lands with ?reactivate=1.
  useEffect(() => {
    if (searchParams.get("reactivate") === "1" && machine && !machine.current_operator_employee_id) {
      openAssignPanel(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine?.id]);

  const startEdit = () => {
    if (!machine) return;
    setEdit(toEditState(machine));
    setSaveError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!machine || !edit) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateMachine(machine.id, {
        name: edit.name || undefined,
        machine_type: edit.machine_type || undefined,
        number_of_heads: edit.number_of_heads ? Number(edit.number_of_heads) : undefined,
        brand: edit.brand || undefined,
        model: edit.model || undefined,
        purchase_date: edit.purchase_date || undefined,
        notes: edit.notes || undefined,
        is_active: edit.is_active,
      });
      setMachine(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!machine) return;
    const nextStatus = e.target.value;
    if (nextStatus === "active" && machine.status !== "active" && !machine.current_operator_employee_id) {
      // Reactivating with nothing currently assigned -- collect that first,
      // since the light only turns green once someone's actually assigned.
      openAssignPanel(true);
      return;
    }
    setChangingStatus(true);
    try {
      const updated = await updateMachine(machine.id, { status: nextStatus });
      setMachine(updated);
      load();
    } finally {
      setChangingStatus(false);
    }
  };

  const handleAssignSave = async () => {
    if (!machine) return;
    setAssignSaving(true);
    setAssignError(null);
    try {
      const updated = await setMachineAssignment(machine.id, {
        current_shift: assignShift,
        current_operator_employee_id: assignOperatorId || undefined,
        current_helper_employee_id: assignHelperId || undefined,
        current_lot_id: assignLotId || undefined,
      });
      let finalMachine = updated;
      if (pendingActivate && updated.status !== "active") {
        finalMachine = await updateMachine(machine.id, { status: "active" });
      }
      setMachine(finalMachine);
      setAssigning(false);
      load();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setAssignSaving(false);
    }
  };

  const handleClearAssignment = async () => {
    if (!machine) return;
    setAssignSaving(true);
    setAssignError(null);
    try {
      const updated = await setMachineAssignment(machine.id, {});
      setMachine(updated);
      setAssigning(false);
      load();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setAssignSaving(false);
    }
  };

  const handleSkipToActive = async () => {
    if (!machine) return;
    setAssignSaving(true);
    setAssignError(null);
    try {
      const updated = await updateMachine(machine.id, { status: "active" });
      setMachine(updated);
      setAssigning(false);
      load();
    } finally {
      setAssignSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!machine) return;
    setPdfError(null);
    setDownloadingPdf(true);
    try {
      const blob = await fetchPdfBlob(`/machines/${machine.id}/status/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setPdfError("Could not generate the status PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{error}</AlertTitle>
        <AlertDescription>
          <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={load}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (machine === null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const light =
    status?.light ??
    (machine.status === "maintenance" || machine.status === "out_of_order" ? machine.status : "idle");
  const shiftEntries = status ? Object.entries(status.quantity_by_shift_today) : [];
  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? "";

  return (
    <div className="space-y-6">
      <Card>
        {/* eslint-disable-next-line @next/next/no-img-element -- static inline SVG placeholder, not an optimizable remote/local asset */}
        <img src={MACHINE_PLACEHOLDER_IMAGE} alt="" className="aspect-[8/3] w-full border-b object-cover" />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-block size-2.5 rounded-full ${LIGHT_DOT[light]}`} title={LIGHT_LABEL[light]} />
                <h1 className="text-2xl font-semibold">{machine.code}</h1>
                <Badge variant={machine.is_active ? "success" : "secondary"}>
                  {machine.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{machine.name ?? "—"}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={machine.status}
                onChange={handleStatusChange}
                disabled={changingStatus || assigning}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf}>
                {downloadingPdf && <Loader2 className="animate-spin" />}
                {downloadingPdf ? "Generating..." : "Download PDF"}
              </Button>
              {!editing && (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  Edit
                </Button>
              )}
            </div>
          </div>
          {pdfError && <p className="text-xs text-destructive">{pdfError}</p>}

          {!editing ? (
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium">{machine.machine_type ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Heads</p>
                <p className="font-medium">{machine.number_of_heads ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Brand / Model</p>
                <p className="font-medium">
                  {machine.brand ?? "—"} {machine.model ?? ""}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Purchase date</p>
                <p className="font-medium">{machine.purchase_date ?? "—"}</p>
              </div>
              {machine.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-muted-foreground">Notes</p>
                  <p className="font-medium">{machine.notes}</p>
                </div>
              )}
            </div>
          ) : (
            edit && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">Name</label>
                    <input
                      value={edit.name}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">Type</label>
                    <input
                      value={edit.machine_type}
                      onChange={(e) => setEdit({ ...edit, machine_type: e.target.value })}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">Heads</label>
                    <input
                      type="number"
                      min={0}
                      value={edit.number_of_heads}
                      onChange={(e) => setEdit({ ...edit, number_of_heads: e.target.value })}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">Brand</label>
                    <input
                      value={edit.brand}
                      onChange={(e) => setEdit({ ...edit, brand: e.target.value })}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">Model</label>
                    <input
                      value={edit.model}
                      onChange={(e) => setEdit({ ...edit, model: e.target.value })}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">Purchase date</label>
                    <input
                      type="date"
                      value={edit.purchase_date}
                      onChange={(e) => setEdit({ ...edit, purchase_date: e.target.value })}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={edit.is_active}
                      onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}
                    />
                    <label htmlFor="is_active" className="text-sm text-muted-foreground">
                      Active
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Notes</label>
                  <textarea
                    value={edit.notes}
                    onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                {saveError && <p className="text-xs text-destructive">{saveError}</p>}

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="animate-spin" />}
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Assign work</h2>
          {!assigning && (
            <Button variant="outline" size="sm" onClick={() => openAssignPanel(false)}>
              {machine.current_operator_employee_id ? "Edit" : "Assign"}
            </Button>
          )}
        </div>

        {assigning ? (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">
              Who's on this machine right now -- separate from logged production, this is just staffing.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Shift</label>
                <select
                  value={assignShift}
                  onChange={(e) => setAssignShift(e.target.value as "morning" | "evening" | "night")}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(SHIFT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Lot</label>
                <select
                  value={assignLotId}
                  onChange={(e) => setAssignLotId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No lot</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_number} · {partyName(lot.party_id)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Operator</label>
                <select
                  value={assignOperatorId}
                  onChange={(e) => setAssignOperatorId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Select operator
                  </option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Helper (optional)</label>
                <select
                  value={assignHelperId}
                  onChange={(e) => setAssignHelperId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No helper</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {pendingActivate && (
              <p className="text-xs text-muted-foreground">
                Saving this will also mark the machine Active. If you skip instead, it'll be marked Active but stay
                idle until someone's actually assigned.
              </p>
            )}

            {assignError && <p className="text-xs text-destructive">{assignError}</p>}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              <Button variant="ghost" size="sm" onClick={() => setAssigning(false)} disabled={assignSaving}>
                Cancel
              </Button>
              {machine.current_operator_employee_id && (
                <Button variant="outline" size="sm" onClick={handleClearAssignment} disabled={assignSaving}>
                  Clear assignment
                </Button>
              )}
              {pendingActivate && (
                <Button variant="outline" size="sm" onClick={handleSkipToActive} disabled={assignSaving}>
                  Skip -- just mark Active
                </Button>
              )}
              <Button size="sm" onClick={handleAssignSave} disabled={assignSaving || !assignOperatorId}>
                {assignSaving && <Loader2 className="animate-spin" />}
                {assignSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="mb-2 font-medium">{LIGHT_LABEL[light]}</p>
            {light === "active" && status ? (
              <div className="space-y-1.5 text-muted-foreground">
                <p>
                  Shift: <span className="text-foreground">{SHIFT_LABELS[status.current_shift ?? ""] ?? status.current_shift}</span>
                </p>
                <p>
                  Operator: <Link href={`/employees/${status.current_operator_id}`} className="text-foreground hover:underline">{status.current_operator_name}</Link>
                  {status.current_helper_id && (
                    <>
                      {" "}
                      &middot; Helper:{" "}
                      <Link href={`/employees/${status.current_helper_id}`} className="text-foreground hover:underline">
                        {status.current_helper_name}
                      </Link>
                    </>
                  )}
                </p>
                {status.current_lot_id && (
                  <p>
                    Lot: <Link href={`/lots/${status.current_lot_id}`} className="text-foreground hover:underline">{status.current_lot_number}</Link>
                    {status.current_design_name && (
                      <>
                        {" "}
                        &middot; Design:{" "}
                        <Link href={`/designs/${status.current_design_id}`} className="text-foreground hover:underline">
                          {status.current_design_name}
                        </Link>
                      </>
                    )}
                    {status.current_party_name && (
                      <>
                        {" "}
                        &middot; Party:{" "}
                        <Link href={`/parties/${status.current_party_id}`} className="text-foreground hover:underline">
                          {status.current_party_name}
                        </Link>
                      </>
                    )}
                  </p>
                )}
                {shiftEntries.length > 0 && (
                  <p className="pt-1">
                    Produced today by shift: {shiftEntries.map(([shift2, qty]) => `${SHIFT_LABELS[shift2] ?? shift2} ${qty}`).join(" · ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">{LIGHT_MESSAGE[light]}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Status history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
                <span>
                  {h.old_status ? `${STATUS_LABELS[h.old_status] ?? h.old_status} → ` : ""}
                  <span className="font-medium">{STATUS_LABELS[h.new_status ?? ""] ?? h.new_status}</span>
                  {h.actor_name && <span className="text-muted-foreground"> by {h.actor_name}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
