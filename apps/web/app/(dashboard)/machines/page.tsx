"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AlertCircle, Cog } from "lucide-react";

import { getMachineStatusBoard, listMachines, updateMachine } from "@embroidery/types";
import type { MachineOut, MachineStatusOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_OPTIONS = ["active", "maintenance", "out_of_order"] as const;

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  maintenance: "Maintenance",
  out_of_order: "Out of Order",
};

// Generic placeholder -- a plain embroidery-machine glyph on a muted card
// background, until real per-machine photos are wired in later. Inline SVG
// data URI so no external asset/upload is needed for this placeholder.
const MACHINE_PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(`
    <svg width="400" height="225" viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="225" fill="#eef0f3"/>
      <g fill="none" stroke="#9aa1ab" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="120" y="92" width="160" height="66" rx="8"/>
        <rect x="150" y="58" width="40" height="40" rx="6"/>
        <line x1="170" y1="58" x2="170" y2="38"/>
        <circle cx="170" cy="32" r="5"/>
        <line x1="140" y1="158" x2="140" y2="178"/>
        <line x1="260" y1="158" x2="260" y2="178"/>
        <circle cx="205" cy="125" r="18"/>
      </g>
    </svg>
  `.trim());

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
  idle: "No entries logged against this machine today.",
};

export default function MachinesPage() {
  const [machines, setMachines] = useState<MachineOut[] | null>(null);
  const [statusBoard, setStatusBoard] = useState<MachineStatusOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setMachines(null);
    Promise.all([listMachines(), getMachineStatusBoard()])
      .then(([machinesData, statusData]) => {
        setMachines(machinesData);
        setStatusBoard(statusData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view machines.");
        } else {
          setError("Could not load machines.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusFor = (machineId: string) => statusBoard.find((s) => s.machine_id === machineId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Machines</h1>

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

      {!error && machines === null && <MachinesGridSkeleton />}

      {!error && machines !== null && machines.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Cog className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No machines yet</p>
          <p className="text-sm text-muted-foreground">Machines you add will show up here.</p>
        </div>
      )}

      {!error && machines !== null && machines.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {machines.map((machine) => (
            <MachineCard key={machine.id} machine={machine} status={statusFor(machine.id)} onStatusChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function MachineCard({
  machine,
  status,
  onStatusChanged,
}: {
  machine: MachineOut;
  status: MachineStatusOut | undefined;
  onStatusChanged: () => void;
}) {
  const router = useRouter();
  const [changingStatus, setChangingStatus] = useState(false);
  const light =
    status?.light ??
    (machine.status === "maintenance" || machine.status === "out_of_order" ? machine.status : "idle");
  const shiftEntries = status ? Object.entries(status.quantity_by_shift_today) : [];

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const nextStatus = e.target.value;
    if (nextStatus === "active" && machine.status !== "active" && !machine.current_operator_employee_id) {
      // Reactivating with nothing currently assigned needs to collect who's
      // on it so the light can actually turn green -- that flow lives on
      // the detail page rather than being duplicated in this compact card.
      router.push(`/machines/${machine.id}?reactivate=1`);
      return;
    }
    setChangingStatus(true);
    try {
      await updateMachine(machine.id, { status: nextStatus });
      onStatusChanged();
    } finally {
      setChangingStatus(false);
    }
  };

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-foreground/30"
      onClick={() => router.push(`/machines/${machine.id}`)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static inline SVG placeholder, not an optimizable remote/local asset */}
      <img src={MACHINE_PLACEHOLDER_IMAGE} alt="" className="aspect-video w-full border-b object-cover" />

      <CardContent className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block size-2.5 rounded-full ${LIGHT_DOT[light]}`}
                title={LIGHT_LABEL[light]}
              />
              <span className="font-semibold">{machine.code}</span>
            </div>
            <p className="text-sm text-muted-foreground">{machine.name ?? "—"}</p>
          </div>
          <Badge variant={machine.is_active ? "success" : "secondary"}>
            {machine.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>

        <select
          value={machine.status}
          onChange={handleStatusChange}
          onClick={(e) => e.stopPropagation()}
          disabled={changingStatus}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs capitalize"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{machine.machine_type ?? "—"}</span>
          <span className="text-right">{machine.number_of_heads ? `${machine.number_of_heads} heads` : "—"}</span>
          <span className="col-span-2">
            {machine.brand ?? "—"}
            {machine.model ? ` ${machine.model}` : ""}
          </span>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="mb-1.5 font-medium text-foreground">{LIGHT_LABEL[light]}</p>

          {light === "active" && status ? (
            <div className="space-y-1 text-muted-foreground">
              <p>
                Shift: <span className="text-foreground">{SHIFT_LABELS[status.current_shift ?? ""] ?? status.current_shift}</span>
              </p>
              <p>
                Operator:{" "}
                <Link
                  href={`/employees/${status.current_operator_id}`}
                  className="text-foreground hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {status.current_operator_name}
                </Link>
                {status.current_helper_id && (
                  <>
                    {" "}
                    &middot; Helper:{" "}
                    <Link
                      href={`/employees/${status.current_helper_id}`}
                      className="text-foreground hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {status.current_helper_name}
                    </Link>
                  </>
                )}
              </p>
              <p>
                Lot:{" "}
                <Link
                  href={`/lots/${status.current_lot_id}`}
                  className="text-foreground hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {status.current_lot_number}
                </Link>
              </p>
              <p>
                Design:{" "}
                <Link
                  href={`/designs/${status.current_design_id}`}
                  className="text-foreground hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {status.current_design_name}
                </Link>
              </p>
              <p>
                Party:{" "}
                <Link
                  href={`/parties/${status.current_party_id}`}
                  className="text-foreground hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {status.current_party_name}
                </Link>
              </p>
              {shiftEntries.length > 0 && (
                <p className="pt-1">
                  Today by shift:{" "}
                  {shiftEntries
                    .map(([shift, qty]) => `${SHIFT_LABELS[shift] ?? shift} ${qty}`)
                    .join(" · ")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">{LIGHT_MESSAGE[light]}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MachinesGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
