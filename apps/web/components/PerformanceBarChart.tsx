interface PerformanceRow {
  id: string;
  label: string;
  totalQuantity: number;
  entryCount: number;
  percentageOfTotal: number;
}

interface PerformanceBarChartProps {
  rows: PerformanceRow[];
  emptyMessage: string;
}

// Sequential accent hue (dataviz skill's categorical slot 1 / default
// sequential blue) -- single series, so no legend needed, only this one hue.
// This app doesn't implement dark mode elsewhere yet, so only the light value
// is used here, matching the rest of the codebase's plain-Tailwind styling.
const BAR_COLOR = "#2a78d6";

export function PerformanceBarChart({ rows, emptyMessage }: PerformanceBarChartProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3 rounded bg-white p-4 shadow">
      {rows.map((row) => {
        const width = Math.max(0, Math.min(100, row.percentageOfTotal));
        return (
          <div key={row.id} className="space-y-1" title={`${row.totalQuantity} units across ${row.entryCount} entries`}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900">{row.label}</span>
              <span className="text-gray-500">
                {row.totalQuantity} units &middot; {row.percentageOfTotal.toFixed(1)}%
              </span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded bg-gray-100">
              <div
                className="h-full rounded"
                style={{ width: `${width}%`, backgroundColor: BAR_COLOR }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
