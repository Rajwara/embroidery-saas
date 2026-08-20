"use client";

import { useMemo, useRef, useState } from "react";

export interface FinancialTrendPoint {
  year: number;
  month: number; // 1-12
  revenue: number;
  expenses: number;
  net: number;
}

interface FinancialTrendChartProps {
  points: FinancialTrendPoint[];
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Same categorical slots/order as FinancialSummaryChart (blue/orange/aqua) --
// this triple validates all-pairs CVD/contrast in both modes, and keeping
// Revenue/Expenses on the same colors across both charts avoids relabeling
// the same series with a different hue elsewhere on the Dashboard.
const SERIES = [
  { key: "revenue", label: "Revenue", color: "#2a78d6" },
  { key: "expenses", label: "Expenses", color: "#eb6834" },
  { key: "net", label: "Net Profit", color: "#1baf7a" },
] as const;

const WIDTH = 760;
const HEIGHT = 260;
const PAD_LEFT = 56;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
}

export function FinancialTrendChart({ points }: FinancialTrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const n = points.length;

  const { yMin, yMax } = useMemo(() => {
    const allValues = points.flatMap((p) => [p.revenue, p.expenses, p.net]);
    const dataMin = Math.min(0, ...allValues);
    const dataMax = Math.max(0, ...allValues, 1);
    const span = dataMax - dataMin || 1;
    return { yMin: dataMin - span * 0.08, yMax: dataMax + span * 0.08 };
  }, [points]);

  const xAt = (i: number) => PAD_LEFT + (n <= 1 ? 0 : (i / (n - 1)) * PLOT_WIDTH);
  const yAt = (v: number) => PAD_TOP + (1 - (v - yMin) / (yMax - yMin)) * PLOT_HEIGHT;
  const zeroY = yAt(0);

  const linePath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`).join(" ");

  // 4 evenly-spaced horizontal gridlines (recessive, not full plot-covering
  // ink) plus the zero baseline, which gets its own distinct dashed
  // treatment since Net can cross it.
  const gridValues = [yMax, yMax - (yMax - yMin) * (1 / 3), yMax - (yMax - yMin) * (2 / 3), yMin];

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const localX = (e.clientX - rect.left) * scaleX;
    const ratio = Math.min(1, Math.max(0, (localX - PAD_LEFT) / PLOT_WIDTH));
    const index = Math.round(ratio * (n - 1));
    setHoverIndex(Math.min(n - 1, Math.max(0, index)));
  };

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  // Flip the tooltip to the left half of the chart once the hovered point
  // is past the midpoint, so it never runs off the right edge.
  const tooltipOnLeft = hoverIndex !== null && hoverIndex > (n - 1) / 2;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Financial trend (last {n} months)</h3>
        <div className="flex flex-wrap gap-4">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {n === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Gridlines + y-axis labels -- recessive, muted ink */}
            {gridValues.map((v, i) => (
              <g key={i}>
                <line
                  x1={PAD_LEFT}
                  x2={WIDTH - PAD_RIGHT}
                  y1={yAt(v)}
                  y2={yAt(v)}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text x={PAD_LEFT - 8} y={yAt(v)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                  {formatAxisValue(v)}
                </text>
              </g>
            ))}

            {/* Zero baseline -- distinct from the regular gridlines since
                Net can cross it; a reader needs to see profit vs. loss at
                a glance, not just relative height. */}
            {yMin < 0 && yMax > 0 && (
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={zeroY}
                y2={zeroY}
                className="stroke-muted-foreground"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {/* X-axis month labels */}
            {points.map((p, i) => (
              <text
                key={i}
                x={xAt(i)}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {MONTH_ABBR[p.month - 1]}
                {p.month === 1 ? ` '${String(p.year).slice(2)}` : ""}
              </text>
            ))}

            {/* The 3 trend lines, 2px, rounded joins/caps */}
            {SERIES.map((s) => (
              <path
                key={s.key}
                d={linePath(points.map((p) => p[s.key]))}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {/* Data-point markers */}
            {SERIES.map((s) =>
              points.map((p, i) => (
                <circle
                  key={`${s.key}-${i}`}
                  cx={xAt(i)}
                  cy={yAt(p[s.key])}
                  r={hoverIndex === i ? 4.5 : 3}
                  fill={s.color}
                  className="stroke-card"
                  strokeWidth={1.5}
                />
              ))
            )}

            {/* Hover crosshair */}
            {hovered && (
              <line
                x1={xAt(hoverIndex!)}
                x2={xAt(hoverIndex!)}
                y1={PAD_TOP}
                y2={HEIGHT - PAD_BOTTOM}
                className="stroke-muted-foreground"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            )}
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute top-2 min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
              style={{
                left: `${(xAt(hoverIndex!) / WIDTH) * 100}%`,
                transform: tooltipOnLeft ? "translateX(-100%) translateX(-10px)" : "translateX(10px)",
              }}
            >
              <div className="mb-1 font-medium text-popover-foreground">
                {MONTH_ABBR[hovered.month - 1]} {hovered.year}
              </div>
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="tabular-nums text-popover-foreground">{formatMoney(hovered[s.key])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
