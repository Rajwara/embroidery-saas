const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-amber-50 text-amber-700" },
  allocated: { label: "Allocated", className: "bg-green-50 text-green-700" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${meta.className}`}>{meta.label}</span>
  );
}
