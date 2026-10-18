"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// The suite's charts (D-021): recharts 3 behind one wrapper, so every chart has the palette
// (viz-1…8, both themes), the same axes, tooltip and legend, loading/empty/error states, and a
// table of the same numbers. In right-to-left languages time runs from the right and the value
// axis sits on the right.
import { useEffect, useId, useState } from "react";
import { Area, AreaChart, Bar, BarChart as ReBarChart, CartesianGrid, Cell, Line, LineChart as ReLineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { cn } from "../lib/cn.js";
import { useFormatter, useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
import { SegmentedControl } from "../components/Choice.js";
import { Skeleton } from "../components/Display.js";
import { EmptyState, ErrorState } from "../components/States.js";
const colorOf = (s, i) => `var(--ot-viz-${s.color ?? (i % 8) + 1})`;
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
function useValue(format) {
    const f = useFormatter();
    return (v) => (typeof v === "number" ? f.number(v, format) : v == null ? "–" : String(v));
}
/** The frame every chart sits in: title, legend, the chart/table switch and the states. */
function ChartFrame({ title, description, actions, loading, error, onRetry, emptyText, empty, height, legend, table, className, headerMinHeight, children, }) {
    const t = useStrings();
    const [view, setView] = useState("chart");
    const id = useId();
    const h = height ?? 240;
    return (_jsxs("figure", { "aria-labelledby": `${id}-t`, className: cn("flex min-w-0 flex-col gap-4 rounded-card border border-line bg-raised p-5", className), children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", style: headerMinHeight === undefined ? undefined : { minHeight: headerMinHeight }, children: [_jsxs("figcaption", { className: "flex min-w-0 flex-col gap-1", children: [_jsx("span", { id: `${id}-t`, className: "font-display text-title-sm text-fg", children: title }), description ? _jsx("span", { className: "text-body-sm text-fg-muted", children: description }) : null] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [actions, !loading && !error && !empty ? (_jsx(SegmentedControl, { size: "sm", label: t("chartView"), value: view, onValueChange: setView, segments: [
                                    { value: "chart", label: t("chartShowChart") },
                                    { value: "table", label: t("chartShowTable") },
                                ] })) : null] })] }), legend && legend.length > 1 && view === "chart" && !loading && !error && !empty ? (_jsx("ul", { className: "flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-fg-muted", children: legend.map((l) => (_jsxs("li", { className: "inline-flex items-center gap-2", children: [l.dashed ? (_jsx("span", { "aria-hidden": "true", className: "w-4 border-t-2 border-dashed", style: { borderColor: l.color } })) : (_jsx("span", { "aria-hidden": "true", className: "size-2.5 rounded-pill", style: { background: l.color } })), l.label] }, l.label))) })) : null, loading ? (_jsx(Skeleton, { style: { height: h }, className: "w-full rounded-field" })) : error ? (_jsx("div", { style: { minHeight: h }, className: "flex items-center justify-center", children: _jsx(ErrorState, { size: "compact", onRetry: onRetry }) })) : empty ? (_jsx("div", { style: { minHeight: h }, className: "flex items-center justify-center", children: _jsx(EmptyState, { size: "compact", title: emptyText ?? t("chartEmpty") }) })) : view === "table" ? (_jsx("div", { className: "max-h-96 overflow-auto rounded-field border border-line", tabIndex: 0, children: _jsxs("table", { className: "w-full text-body-sm", children: [_jsx("thead", { className: "sticky top-0 bg-sunken text-fg-muted", children: _jsx("tr", { children: table.head.map((c, i) => (_jsx("th", { scope: "col", className: cn("px-3 py-2 font-medium", i === 0 ? "text-start" : "text-end"), children: c }, c))) }) }), _jsx("tbody", { children: table.rows.map((r, i) => (_jsx("tr", { className: "border-t border-line", children: r.map((c, j) => j === 0 ? (_jsx("th", { scope: "row", className: "px-3 py-2 text-start font-normal text-fg", children: c }, j)) : (_jsx("td", { className: "px-3 py-2 text-end text-fg tabular-nums", children: c }, j))) }, i))) })] }) })) : (_jsx("div", { style: { height: h }, className: "w-full min-w-0", dir: "ltr", children: children }))] }));
}
function TooltipBox({ active, payload, label, xFormat, value }) {
    const { dir } = useOrgtik();
    if (!active || !payload?.length)
        return null;
    return (_jsxs("div", { dir: dir, className: "min-w-36 rounded-overlay border border-line bg-overlay px-3 py-2 text-body-sm shadow-overlay", children: [label != null ? _jsx("div", { className: "mb-1 font-medium text-fg", children: xFormat ? xFormat(label) : String(label) }) : null, _jsx("ul", { className: "flex flex-col gap-1", children: payload.map((p) => (_jsxs("li", { className: "flex items-center justify-between gap-4", children: [_jsxs("span", { className: "inline-flex items-center gap-2 text-fg-muted", children: [_jsx("span", { "aria-hidden": "true", className: "size-2.5 rounded-pill", style: { background: p.color } }), p.name] }), _jsx("span", { className: "text-fg tabular-nums", children: value(p.value) })] }, String(p.dataKey)))) })] }));
}
const tableOf = (data, x, series, value) => ({
    head: [x.label, ...series.map((s) => s.label)],
    rows: data.map((d) => [x.format ? x.format(d[x.key]) : String(d[x.key]), ...series.map((s) => value(d[s.key]))]),
});
/** Change over time: one line per series; `area` fills under a single series. */
export function LineChart({ data, x, series, area, ...common }) {
    const { dir } = useOrgtik();
    const rtl = dir === "rtl";
    const value = useValue(common.valueFormat);
    const animate = !useReducedMotion();
    const Chart = area ? AreaChart : ReLineChart;
    return (_jsx(ChartFrame, { ...common, empty: !data.length, legend: series.map((s, i) => ({ label: s.label, color: colorOf(s, i), dashed: s.dashed })), table: tableOf(data, x, series, value), children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(Chart, { data: data, margin: { top: 8, right: 8, bottom: 0, left: 8 }, accessibilityLayer: true, children: [_jsx(CartesianGrid, { vertical: false, stroke: "var(--ot-line)" }), _jsx(XAxis, { dataKey: x.key, reversed: rtl, tick: tick, tickLine: false, axisLine: { stroke: "var(--ot-line)" }, tickFormatter: x.format, minTickGap: 24, padding: { left: 24, right: 24 } }), _jsx(YAxis, { orientation: rtl ? "right" : "left", tick: tick, tickLine: false, axisLine: false, width: 48, tickFormatter: (v) => value(v) }), _jsx(Tooltip, { cursor: { stroke: "var(--ot-line-strong)" }, content: _jsx(TooltipBox, { xFormat: x.format, value: value }) }), series.map((s, i) => area ? (_jsx(Area, { type: "monotone", dataKey: s.key, name: s.label, stroke: colorOf(s, i), fill: colorOf(s, i), fillOpacity: 0.14, strokeWidth: 2, isAnimationActive: animate }, s.key)) : (_jsx(Line, { type: "monotone", dataKey: s.key, name: s.label, stroke: colorOf(s, i), strokeWidth: 2, strokeDasharray: s.dashed ? "6 4" : undefined, dot: false, activeDot: { r: 4 }, isAnimationActive: animate }, s.key)))] }) }) }));
}
// A row's name beside its bar: shortened with an ellipsis to fit, the whole name on hover and in
// the table view.
const LABEL_WIDTH = 168;
function RowLabel({ x, y, payload, rtl, format, width }) {
    const full = payload ? (format ? format(payload.value) : String(payload.value)) : "";
    const max = Math.max(2, Math.floor((width - 12) / 6.6));
    const shown = full.length > max ? `${full.slice(0, max - 1)}…` : full;
    return (_jsxs("text", { x: x, y: y, dy: 4, textAnchor: rtl ? "start" : "end", fill: "var(--ot-fg-subtle)", fontSize: 12, children: [_jsx("title", { children: full }), shown] }));
}
/** Amounts by category: columns, or `layout="rows"` for long names (a ranking). */
export function BarChart({ data, x, series, stacked, layout = "columns", labelWidth = LABEL_WIDTH, maxBarSize, ...common }) {
    const { dir } = useOrgtik();
    const rtl = dir === "rtl";
    const value = useValue(common.valueFormat);
    const animate = !useReducedMotion();
    const rows = layout === "rows";
    const height = common.height ?? (rows ? Math.max(160, data.length * 36 + 24) : 240);
    return (_jsx(ChartFrame, { ...common, height: height, empty: !data.length, legend: series.map((s, i) => ({ label: s.label, color: colorOf(s, i) })), table: tableOf(data, x, series, value), children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(ReBarChart, { data: data, layout: rows ? "vertical" : "horizontal", margin: { top: 8, right: 8, bottom: 0, left: 8 }, accessibilityLayer: true, barCategoryGap: rows ? 8 : "20%", children: [_jsx(CartesianGrid, { vertical: rows, horizontal: !rows, stroke: "var(--ot-line)" }), rows ? (_jsxs(_Fragment, { children: [_jsx(XAxis, { type: "number", reversed: rtl, tick: tick, tickLine: false, axisLine: false, tickFormatter: (v) => value(v) }), _jsx(YAxis, { type: "category", dataKey: x.key, orientation: rtl ? "right" : "left", tickLine: false, axisLine: false, width: labelWidth, tick: _jsx(RowLabel, { rtl: rtl, format: x.format, width: labelWidth }) })] })) : (_jsxs(_Fragment, { children: [_jsx(XAxis, { dataKey: x.key, reversed: rtl, tick: tick, tickLine: false, axisLine: { stroke: "var(--ot-line)" }, tickFormatter: x.format }), _jsx(YAxis, { orientation: rtl ? "right" : "left", tick: tick, tickLine: false, axisLine: false, width: 48, tickFormatter: (v) => value(v) })] })), _jsx(Tooltip, { cursor: { fill: "var(--ot-hover)" }, content: _jsx(TooltipBox, { xFormat: x.format, value: value }) }), series.map((s, i) => (_jsx(Bar, { dataKey: s.key, name: s.label, fill: colorOf(s, i), maxBarSize: maxBarSize, stackId: stacked ? "all" : undefined, 
                        // Only the outer end is rounded; in a stack, only the last segment has one.
                        radius: stacked && i < series.length - 1 ? 0 : rows ? (rtl ? [4, 0, 0, 4] : [0, 4, 4, 0]) : [4, 4, 0, 0], isAnimationActive: animate }, s.key)))] }) }) }));
}
/** Parts of a whole (up to about six): a ring with the total in the middle. */
export function DonutChart({ data, totalLabel, categoryLabel, valueLabel, ...common }) {
    const value = useValue(common.valueFormat);
    const f = useFormatter();
    const animate = !useReducedMotion();
    const total = data.reduce((n, d) => n + d.value, 0);
    const series = data.map((d) => ({ key: d.key, label: d.label }));
    return (_jsx(ChartFrame, { ...common, empty: !data.length || total === 0, legend: data.map((d, i) => ({ label: `${d.label} · ${f.percent(d.value / (total || 1))}`, color: colorOf(series[i], i) })), table: { head: [categoryLabel, valueLabel, "%"], rows: data.map((d) => [d.label, value(d.value), f.percent(d.value / (total || 1), 1)]) }, children: _jsxs("div", { className: "relative h-full", children: [_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { accessibilityLayer: true, children: [_jsx(Pie, { data: data, dataKey: "value", nameKey: "label", innerRadius: "62%", outerRadius: "90%", paddingAngle: 1, stroke: "var(--ot-bg-raised)", isAnimationActive: animate, children: data.map((d, i) => (_jsx(Cell, { fill: colorOf(series[i], i) }, d.key))) }), _jsx(Tooltip, { content: _jsx(TooltipBox, { value: value }) })] }) }), _jsxs("div", { className: "pointer-events-none absolute inset-0 flex flex-col items-center justify-center", children: [_jsx("span", { className: "font-display text-title text-fg tabular-nums", children: value(total) }), totalLabel ? _jsx("span", { className: "text-caption text-fg-subtle", children: totalLabel }) : null] })] }) }));
}
//# sourceMappingURL=index.js.map