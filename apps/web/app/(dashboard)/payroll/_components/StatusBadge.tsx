import { Badge } from "@/components/ui/badge";

const STATUS_META: Record<string, { label: string; variant: "warning" | "success" | "secondary" }> = {
  draft: { label: "Draft", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
