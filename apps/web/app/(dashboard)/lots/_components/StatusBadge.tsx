const STATUS_META: Record<string, { label: string; className: string }> = {
  pending_breakdown: { label: "Pending breakdown", className: "bg-amber-50 text-amber-700" },
  pending_confirmation: { label: "Pending confirmation", className: "bg-blue-50 text-blue-700" },
  confirmed: { label: "Confirmed", className: "bg-green-50 text-green-700" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${meta.className}`}>{meta.label}</span>
  );
}
