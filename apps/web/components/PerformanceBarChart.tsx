import Link from "next/link";

interface PerformanceRow {
  id: string;
  label: string;
  totalQuantity: number;
  entryCount: number;
  percentageOfTotal: number;
  totalStitches: number;
  quantityMissingStitchCount: number;
  // Only Employee Performance rows link out (to /employees/[id]) -- Machine
  // Performance rows have nowhere to link to yet, so this stays optional.
  href?: string;
}

interface PerformanceBarChartProps {
  rows: PerformanceRow[];
  emptyMessage: string;
}

// Brand blue (--chart-1 token, same as the rest of the app's categorical
// order) -- single series, so no legend needed, just this one hue. Reads
// the CSS token so it resolves correctly in both light and dark mode.
const BAR_COLOR = "oklch(var(--chart-1))";

// Stitch counts are computed from DesignVariant.stitch_count, which is
// nullable and often unset (see app/stitch_resolution.py) -- showing "0
// stitches" for real production would misrepresent it as verified-zero, so
// the primary figure falls back to piece count with a note instead.
function headline(row: PerformanceRow): string {
  if (row.totalStitches > 0 && row.quantityMissingStitchCount === 0) {
    return `${row.totalStitches.toLocaleString()} stitches`;
  }
  if (row.totalStitches > 0) {
    return `${row.totalStitches.toLocaleString()} stitches + ${row.quantityMissingStitchCount.toLocaleString()} units (no stitch count set)`;
  }
  return `${row.totalQuantity.toLocaleString()} units (stitch count not set)`;
}

export function PerformanceBarChart({ rows, emptyMessage }: PerformanceBarChartProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3 rounded bg-white p-4 shadow">
      {rows.map((row) => {
        const width = Math.max(0, Math.min(100, row.percentageOfTotal));
        return (
          <div
            key={row.id}
            className="space-y-1"
            title={`${row.totalQuantity} units across ${row.entryCount} entries`}
          >
            <div className="flex items-center justify-between text-sm">
              {row.href ? (
                <Link href={row.href} className="font-medium text-gray-900 hover:underline">
                  {row.label}
                </Link>
              ) : (
                <span className="font-medium text-gray-900">{row.label}</span>
              )}
              <span className="text-gray-500">
                {headline(row)} &middot; {row.percentageOfTotal.toFixed(1)}%
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
