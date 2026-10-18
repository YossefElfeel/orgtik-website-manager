"use client";
// The suite's charts (D-021): recharts 3 behind one wrapper, so every chart has the palette
// (viz-1…8, both themes), the same axes, tooltip and legend, loading/empty/error states, and a
// table of the same numbers. In right-to-left languages time runs from the right and the value
// axis sits on the right.
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "../lib/cn.js";
import { useFormatter, useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
import { SegmentedControl } from "../components/Choice.js";
import { Skeleton } from "../components/Display.js";
import { EmptyState, ErrorState } from "../components/States.js";

export type ChartSeries = {
  key: string;
  label: string;
  /** Which palette colour (1–8). Default: its place in the list. */
  color?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** A dashed line (a comparison, a target), so two series differ by more than colour. Lines only. */
  dashed?: boolean;
};
type Datum = Record<string, string | number | null>;
type Common = {
  title: ReactNode;
  description?: ReactNode;
  /** Controls beside the title (a period switch). */
  actions?: ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** What an empty chart says; defaults to the library's "No data for this period yet." */
  emptyText?: ReactNode;
  height?: number;
  /** How values read (on the axis, in the tooltip and the table). */
  valueFormat?: Intl.NumberFormatOptions;
  className?: string;
  /** Align chart areas when cards have different amounts of heading copy. */
  headerMinHeight?: number;
};
type Cartesian = Common & {
  data: Datum[];
  /** The category or time field, and how its values read. */
  x: { key: string; label: string; format?: (v: string | number) => string };
  series: ChartSeries[];
};

const colorOf = (s: ChartSeries, i: number) => `var(--ot-viz-${s.color ?? (i % 8) + 1})`;
const tick = { fill: "var(--ot-fg-subtle)", fontSize: 12 };

function useReducedMotion() {
  // Read at once (not after the first paint), so a chart never starts an animation it must drop.
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

function useValue(format?: Intl.NumberFormatOptions) {
  const f = useFormatter();
  return (v: unknown) => (typeof v === "number" ? f.number(v, format) : v == null ? "–" : String(v));
}

/** The frame every chart sits in: title, legend, the chart/table switch and the states. */
function ChartFrame({
  title,
  description,
  actions,
  loading,
  error,
  onRetry,
  emptyText,
  empty,
  height,
  legend,
  table,
  className,
  headerMinHeight,
  children,
}: Common & { empty: boolean; legend?: { label: string; color: string; dashed?: boolean }[]; table: { head: string[]; rows: ReactNode[][] }; children: ReactNode }) {
  const t = useStrings();
  const [view, setView] = useState<"chart" | "table">("chart");
  const id = useId();
  const h = height ?? 240;
  return (
    <figure aria-labelledby={`${id}-t`} className={cn("flex min-w-0 flex-col gap-4 rounded-card border border-line bg-raised p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3" style={headerMinHeight === undefined ? undefined : { minHeight: headerMinHeight }}>
        <figcaption className="flex min-w-0 flex-col gap-1">
          <span id={`${id}-t`} className="font-display text-title-sm text-fg">
            {title}
          </span>
          {description ? <span className="text-body-sm text-fg-muted">{description}</span> : null}
        </figcaption>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {!loading && !error && !empty ? (
            <SegmentedControl
              size="sm"
              label={t("chartView")}
              value={view}
              onValueChange={setView}
              segments={[
                { value: "chart", label: t("chartShowChart") },
                { value: "table", label: t("chartShowTable") },
              ]}
            />
          ) : null}
        </div>
      </div>
      {legend && legend.length > 1 && view === "chart" && !loading && !error && !empty ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-fg-muted">
          {legend.map((l) => (
            <li key={l.label} className="inline-flex items-center gap-2">
              {l.dashed ? (
                <span aria-hidden="true" className="w-4 border-t-2 border-dashed" style={{ borderColor: l.color }} />
              ) : (
                <span aria-hidden="true" className="size-2.5 rounded-pill" style={{ background: l.color }} />
              )}
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}
      {loading ? (
        <Skeleton style={{ height: h }} className="w-full rounded-field" />
      ) : error ? (
        <div style={{ minHeight: h }} className="flex items-center justify-center">
          <ErrorState size="compact" onRetry={onRetry} />
        </div>
      ) : empty ? (
        <div style={{ minHeight: h }} className="flex items-center justify-center">
          <EmptyState size="compact" title={emptyText ?? t("chartEmpty")} />
        </div>
      ) : view === "table" ? (
        <div className="max-h-96 overflow-auto rounded-field border border-line" tabIndex={0}>
          <table className="w-full text-body-sm">
            <thead className="sticky top-0 bg-sunken text-fg-muted">
              <tr>
                {table.head.map((c, i) => (
                  <th key={c} scope="col" className={cn("px-3 py-2 font-medium", i === 0 ? "text-start" : "text-end")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((c, j) =>
                    j === 0 ? (
                      <th key={j} scope="row" className="px-3 py-2 text-start font-normal text-fg">
                        {c}
                      </th>
                    ) : (
                      <td key={j} className="px-3 py-2 text-end text-fg tabular-nums">
                        {c}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height: h }} className="w-full min-w-0" dir="ltr">
          {children}
        </div>
      )}
    </figure>
  );
}

function TooltipBox({ active, payload, label, xFormat, value }: { active?: boolean; payload?: { name?: string; value?: unknown; color?: string; dataKey?: string | number }[]; label?: string | number; xFormat?: (v: string | number) => string; value: (v: unknown) => string }) {
  const { dir } = useOrgtik();
  if (!active || !payload?.length) return null;
  return (
    <div dir={dir} className="min-w-36 rounded-overlay border border-line bg-overlay px-3 py-2 text-body-sm shadow-overlay">
      {label != null ? <div className="mb-1 font-medium text-fg">{xFormat ? xFormat(label) : String(label)}</div> : null}
      <ul className="flex flex-col gap-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-fg-muted">
              <span aria-hidden="true" className="size-2.5 rounded-pill" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="text-fg tabular-nums">{value(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const tableOf = (data: Datum[], x: Cartesian["x"], series: ChartSeries[], value: (v: unknown) => string) => ({
  head: [x.label, ...series.map((s) => s.label)],
  rows: data.map((d) => [x.format ? x.format(d[x.key] as string | number) : String(d[x.key]), ...series.map((s) => value(d[s.key]))]),
});

/** Change over time: one line per series; `area` fills under a single series. */
export function LineChart({ data, x, series, area, ...common }: Cartesian & { area?: boolean }) {
  const { dir } = useOrgtik();
  const rtl = dir === "rtl";
  const value = useValue(common.valueFormat);
  const animate = !useReducedMotion();
  const Chart = area ? AreaChart : ReLineChart;
  return (
    <ChartFrame {...common} empty={!data.length} legend={series.map((s, i) => ({ label: s.label, color: colorOf(s, i), dashed: s.dashed }))} table={tableOf(data, x, series, value)}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--ot-line)" />
          <XAxis dataKey={x.key} reversed={rtl} tick={tick} tickLine={false} axisLine={{ stroke: "var(--ot-line)" }} tickFormatter={x.format} minTickGap={24} padding={{ left: 24, right: 24 }} />
          <YAxis orientation={rtl ? "right" : "left"} tick={tick} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => value(v)} />
          <Tooltip cursor={{ stroke: "var(--ot-line-strong)" }} content={<TooltipBox xFormat={x.format} value={value} />} />
          {series.map((s, i) =>
            area ? (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={colorOf(s, i)} fill={colorOf(s, i)} fillOpacity={0.14} strokeWidth={2} isAnimationActive={animate} />
            ) : (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={colorOf(s, i)} strokeWidth={2} strokeDasharray={s.dashed ? "6 4" : undefined} dot={false} activeDot={{ r: 4 }} isAnimationActive={animate} />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

// A row's name beside its bar: shortened with an ellipsis to fit, the whole name on hover and in
// the table view.
const LABEL_WIDTH = 168;
function RowLabel({ x, y, payload, rtl, format, width }: { x?: number; y?: number; payload?: { value: string | number }; rtl: boolean; format?: (v: string | number) => string; width: number }) {
  const full = payload ? (format ? format(payload.value) : String(payload.value)) : "";
  const max = Math.max(2, Math.floor((width - 12) / 6.6));
  const shown = full.length > max ? `${full.slice(0, max - 1)}…` : full;
  return (
    <text x={x} y={y} dy={4} textAnchor={rtl ? "start" : "end"} fill="var(--ot-fg-subtle)" fontSize={12}>
      <title>{full}</title>
      {shown}
    </text>
  );
}

/** Amounts by category: columns, or `layout="rows"` for long names (a ranking). */
export function BarChart({ data, x, series, stacked, layout = "columns", labelWidth = LABEL_WIDTH, maxBarSize, ...common }: Cartesian & {
  stacked?: boolean;
  layout?: "columns" | "rows";
  /** Space for row labels; use less for short categories such as page paths. */
  labelWidth?: number;
  /** Keeps bars readable when charts with different category counts share a height. */
  maxBarSize?: number;
}) {
  const { dir } = useOrgtik();
  const rtl = dir === "rtl";
  const value = useValue(common.valueFormat);
  const animate = !useReducedMotion();
  const rows = layout === "rows";
  const height = common.height ?? (rows ? Math.max(160, data.length * 36 + 24) : 240);
  return (
    <ChartFrame {...common} height={height} empty={!data.length} legend={series.map((s, i) => ({ label: s.label, color: colorOf(s, i) }))} table={tableOf(data, x, series, value)}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} layout={rows ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} accessibilityLayer barCategoryGap={rows ? 8 : "20%"}>
          <CartesianGrid vertical={rows} horizontal={!rows} stroke="var(--ot-line)" />
          {rows ? (
            <>
              <XAxis type="number" reversed={rtl} tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => value(v)} />
              <YAxis type="category" dataKey={x.key} orientation={rtl ? "right" : "left"} tickLine={false} axisLine={false} width={labelWidth} tick={<RowLabel rtl={rtl} format={x.format} width={labelWidth} />} />
            </>
          ) : (
            <>
              <XAxis dataKey={x.key} reversed={rtl} tick={tick} tickLine={false} axisLine={{ stroke: "var(--ot-line)" }} tickFormatter={x.format} />
              <YAxis orientation={rtl ? "right" : "left"} tick={tick} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => value(v)} />
            </>
          )}
          <Tooltip cursor={{ fill: "var(--ot-hover)" }} content={<TooltipBox xFormat={x.format} value={value} />} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={colorOf(s, i)}
              maxBarSize={maxBarSize}
              stackId={stacked ? "all" : undefined}
              // Only the outer end is rounded; in a stack, only the last segment has one.
              radius={stacked && i < series.length - 1 ? 0 : rows ? (rtl ? [4, 0, 0, 4] : [0, 4, 4, 0]) : [4, 4, 0, 0]}
              isAnimationActive={animate}
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Parts of a whole (up to about six): a ring with the total in the middle. */
export function DonutChart({
  data,
  totalLabel,
  categoryLabel,
  valueLabel,
  ...common
}: Common & {
  data: { key: string; label: string; value: number }[];
  totalLabel?: ReactNode;
  /** The table's column names: what the parts are ("Channel") and what's counted ("Leads"). */
  categoryLabel: string;
  valueLabel: string;
}) {
  const value = useValue(common.valueFormat);
  const f = useFormatter();
  const animate = !useReducedMotion();
  const total = data.reduce((n, d) => n + d.value, 0);
  const series = data.map((d) => ({ key: d.key, label: d.label }));
  return (
    <ChartFrame
      {...common}
      empty={!data.length || total === 0}
      legend={data.map((d, i) => ({ label: `${d.label} · ${f.percent(d.value / (total || 1))}`, color: colorOf(series[i], i) }))}
      table={{ head: [categoryLabel, valueLabel, "%"], rows: data.map((d) => [d.label, value(d.value), f.percent(d.value / (total || 1), 1)]) }}
    >
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="90%" paddingAngle={1} stroke="var(--ot-bg-raised)" isAnimationActive={animate}>
              {data.map((d, i) => (
                <Cell key={d.key} fill={colorOf(series[i], i)} />
              ))}
            </Pie>
            <Tooltip content={<TooltipBox value={value} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-title text-fg tabular-nums">{value(total)}</span>
          {totalLabel ? <span className="text-caption text-fg-subtle">{totalLabel}</span> : null}
        </div>
      </div>
    </ChartFrame>
  );
}
