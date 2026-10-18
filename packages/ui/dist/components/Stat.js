"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowDownRight, ArrowUpRight, Minus } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useFormatter, useStrings } from "../provider/OrgtikProvider.js";
import { Skeleton } from "./Display.js";
/**
 * One figure with its label and, optionally, how it moved. The change says its direction in words
 * as well as with an arrow and a tone, so it doesn't depend on colour.
 */
export function Stat({ label, value, change, hint, icon, loading, className, sparkline, }) {
    const t = useStrings();
    const f = useFormatter();
    const dir = !change || change.value === 0 ? "flat" : change.value > 0 ? "up" : "down";
    const good = change && dir !== "flat" && dir === (change.good ?? "up");
    const amount = change ? (change.format === "number" ? f.number(Math.abs(change.value)) : f.percent(Math.abs(change.value), 1)) : "";
    return (_jsxs("div", { className: cn("flex min-w-0 flex-col gap-2 rounded-card border border-line bg-raised p-5 shadow-xs", className), children: [_jsxs("div", { className: "flex items-center gap-2 text-body-sm text-fg-muted", children: [icon ? _jsx("span", { "aria-hidden": "true", className: "flex size-5 shrink-0 items-center justify-center text-fg-subtle [&>svg]:size-5", children: icon }) : null, _jsx("span", { className: "min-w-0 truncate", children: label })] }), loading ? (_jsx(Skeleton, { className: "h-9 w-24" })) : (_jsx("div", { className: "font-display text-title-lg text-fg tabular-nums", children: value })), change && !loading ? (_jsxs("div", { className: "flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm", children: [_jsxs("span", { className: cn("inline-flex items-center gap-1 font-medium", dir === "flat" ? "text-fg-muted" : good ? "text-success" : "text-danger"), children: [_jsx("span", { "aria-hidden": "true", className: "[&>svg]:size-4 rtl:[&>svg]:-scale-x-100", children: dir === "up" ? _jsx(ArrowUpRight, { weight: "bold" }) : dir === "down" ? _jsx(ArrowDownRight, { weight: "bold" }) : _jsx(Minus, { weight: "bold" }) }), dir === "flat" ? t("statFlat") : t(dir === "up" ? "statUp" : "statDown", { amount })] }), change.against ? _jsx("span", { className: "text-fg-subtle", children: change.against }) : null] })) : null, hint ? _jsx("p", { className: "text-caption text-fg-subtle", children: hint }) : null, sparkline?.length && !loading ? _jsx("svg", { viewBox: "0 0 120 28", "aria-hidden": "true", className: "h-7 w-full text-fg-brand", children: _jsx("polyline", { fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", points: sparkline.map((point, index) => `${2 + index / (Math.max(1, sparkline.length - 1)) * 116},${26 - (point - Math.min(...sparkline)) / Math.max(1, Math.max(...sparkline) - Math.min(...sparkline)) * 24}`).join(" ") }) }) : null] }));
}
//# sourceMappingURL=Stat.js.map