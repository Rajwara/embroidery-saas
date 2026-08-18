interface FinancialSummaryChartProps {
  revenue: number;
  expenses: number;
  purchases: number;
}

// Categorical slots 1/2/3 (blue/orange/aqua) in fixed order -- the dataviz
// skill's palette.md notes these three specifically validate all-pairs in
// both modes (not just adjacent), which matters here since all three bars
// are visible simultaneously, not just neighbor-compared.
const SERIES = [
  { key: "revenue", label: "Revenue", color: "#2a78d6" },
  { key: "expenses", label: "Expenses", color: "#eb6834" },
  { key: "purchases", label: "Purchases", color: "#1baf7a" },
] as const;

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FinancialSummaryChart({ revenue, expenses, purchases }: FinancialSummaryChartProps) {
  const values: Record<string, number> = { revenue, expenses, purchases };
  const max = Math.max(revenue, expenses, purchases, 1);

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      {/* Legend -- always present for 2+ series, the dependable identity channel */}
      <div className="flex flex-wrap gap-4">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {SERIES.map((s) => {
          const value = values[s.key];
          const width = Math.max(0, Math.min(100, (value / max) * 100));
          return (
            <div key={s.key} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm text-muted-foreground">{s.label}</span>
              <div className="h-4 min-w-0 flex-1">
                <div
                  className="h-full rounded-r-[4px] rounded-l-none"
                  style={{ width: `${width}%`, backgroundColor: s.color }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
                {formatMoney(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
