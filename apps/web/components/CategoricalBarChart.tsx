interface CategoricalBarChartProps {
  data: { label: string; value: number }[];
  valueFormatter?: (value: number) => string;
}

// Categorical slots 1-8 in fixed order (dataviz skill's palette.md) -- this
// order passes every adjacent-pair CVD/contrast gate in both modes, so it's
// safe up to 8 series for a bar chart (the "first three only" caveat in
// palette.md is specifically for all-pairs-simultaneous forms like scatter/
// choropleth, not sequential bars).
const SLOTS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

export function CategoricalBarChart({ data, valueFormatter = (v) => v.toLocaleString() }: CategoricalBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      {data.map((row, i) => {
        const width = Math.max(0, Math.min(100, (row.value / max) * 100));
        const color = SLOTS[i % SLOTS.length];
        return (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm text-muted-foreground" title={row.label}>
              {row.label}
            </span>
            <div className="h-4 min-w-0 flex-1">
              <div className="h-full rounded-r-[4px]" style={{ width: `${width}%`, backgroundColor: color }} />
            </div>
            <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
              {valueFormatter(row.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
