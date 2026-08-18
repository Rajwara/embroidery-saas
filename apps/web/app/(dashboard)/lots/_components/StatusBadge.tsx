import { Badge } from "@/components/ui/badge";

const STATUS_META: Record<string, { label: string; variant: "warning" | "default" | "success" | "secondary" }> = {
  pending_breakdown: { label: "Pending breakdown", variant: "warning" },
  pending_confirmation: { label: "Pending confirmation", variant: "default" },
  confirmed: { label: "Confirmed", variant: "success" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
