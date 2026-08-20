interface CategoricalBarChartProps {
  data: { label: string; value: number }[];
  valueFormatter?: (value: number) => string;
}

// Brand categorical order (slots 1-5), validated for CVD-safety and
// contrast via the dataviz skill's checker -- same order as --chart-1..5
// in globals.css. Slots 6-8 fall back to the skill's original default
// palette (already validated on its own), since the 6-color brand set
// doesn't stretch to 8 distinct categories -- a rare case (most bar charts
// here have <=5 categories) so exact brand hue match matters less there.
const SLOTS = [
  "#0077B6", // brand blue
  "#009B72", // brand green
  "#FF8C00", // brand orange
  "#8A2BE2", // brand purple
  "#E63946", // brand red
  "#eda100", // yellow (fallback, slot 6+)
  "#e87ba4", // magenta (fallback, slot 7+)
  "#4a3aa7", // violet (fallback, slot 8)
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
