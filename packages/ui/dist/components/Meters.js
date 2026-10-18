"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Progress as BaseProgress } from "@base-ui/react/progress";
import { Meter as BaseMeter } from "@base-ui/react/meter";
import { CheckCircle, Warning, WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { formatLocale } from "../locale.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
const track = "h-2 w-full overflow-hidden rounded-pill bg-sunken";
/** How far a task has got (an upload, an import). `value` null means "working, amount unknown". */
export function Progress({ value, label, max = 100, className }) {
    const { locale, digits } = useOrgtik();
    return (_jsxs(BaseProgress.Root, { value: value, max: max, locale: formatLocale(locale, digits), className: cn("flex flex-col gap-1.5", className), children: [_jsxs("div", { className: "flex items-center justify-between gap-3 text-body-sm", children: [_jsx(BaseProgress.Label, { className: "text-fg", children: label }), _jsx(BaseProgress.Value, { className: "text-fg-muted tabular-nums" })] }), _jsx(BaseProgress.Track, { className: track, children: _jsx(BaseProgress.Indicator, { className: "block h-full rounded-pill bg-action-primary transition-[width] duration-(--ot-duration-base) data-[indeterminate]:w-1/3 data-[indeterminate]:animate-pulse" }) })] }));
}
/** A measurement in a known range (storage used, a score). Not for progress over time. */
export function Meter({ value, label, min = 0, max = 100, format, className }) {
    const { locale, digits } = useOrgtik();
    return (_jsxs(BaseMeter.Root, { value: value, min: min, max: max, format: format, locale: formatLocale(locale, digits), className: cn("flex flex-col gap-1.5", className), children: [_jsxs("div", { className: "flex items-center justify-between gap-3 text-body-sm", children: [_jsx(BaseMeter.Label, { className: "text-fg", children: label }), _jsx(BaseMeter.Value, { className: "text-fg-muted tabular-nums" })] }), _jsx(BaseMeter.Track, { className: track, children: _jsx(BaseMeter.Indicator, { className: "block h-full rounded-pill bg-fg-brand" }) })] }));
}
/** The spec's limit states: OK below 80%, near from 80%, full at the limit, over past it. */
export function limitState(used, limit) {
    if (limit <= 0)
        return used > 0 ? "over" : "full";
    if (used > limit)
        return "over";
    if (used === limit)
        return "full";
    return used / limit >= 0.8 ? "near" : "ok";
}
const LIMIT_STYLE = {
    ok: { bar: "bg-action-primary", text: "text-fg-muted", icon: null },
    near: { bar: "bg-warning-solid", text: "text-warning", icon: _jsx(Warning, { weight: "fill" }) },
    full: { bar: "bg-danger-solid", text: "text-danger", icon: _jsx(WarningCircle, { weight: "fill" }) },
    over: { bar: "bg-danger-solid", text: "text-danger", icon: _jsx(WarningCircle, { weight: "fill" }) },
};
/**
 * Use against a plan's limit (seats, storage, projects). The state is spoken, not only coloured,
 * and past 80% it says what to do next through `action` (e.g. "Add seats"). The bar never draws
 * past full; "over" says by how much.
 */
export function LimitMeter({ used, limit, label, unit, action, className, }) {
    const t = useStrings();
    const { locale, digits } = useOrgtik();
    const state = limitState(used, limit);
    const style = LIMIT_STYLE[state];
    const show = unit ?? ((n) => new Intl.NumberFormat(formatLocale(locale, digits)).format(n));
    const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
    const words = { ok: null, near: t("limitNear"), full: t("limitFull"), over: t("limitOver", { amount: show(used - limit) }) }[state];
    return (_jsxs("div", { className: cn("flex flex-col gap-1.5", className), "data-limit": state, children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-body-sm", children: [_jsx("span", { className: "text-fg", children: label }), _jsx("span", { className: "tabular-nums text-fg-muted", children: t("limitOf", { used: show(used), limit: show(limit) }) })] }), _jsx("div", { role: "meter", "aria-valuemin": 0, "aria-valuemax": limit, "aria-valuenow": Math.min(used, limit), "aria-valuetext": `${t("limitOf", { used: show(used), limit: show(limit) })}${words ? `. ${words}` : ""}`, "aria-label": typeof label === "string" ? label : undefined, className: track, children: _jsx("span", { className: cn("block h-full rounded-pill transition-[width] duration-(--ot-duration-base)", style.bar), style: { width: `${pct}%` } }) }), words || action ? (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [words ? (_jsxs("span", { className: cn("inline-flex items-center gap-1.5 text-caption font-semibold [&_svg]:size-4", style.text), children: [style.icon, words] })) : (_jsx("span", { className: "inline-flex items-center gap-1.5 text-caption text-fg-muted [&_svg]:size-4", children: _jsx(CheckCircle, { "aria-hidden": "true" }) })), action] })) : null] }));
}
//# sourceMappingURL=Meters.js.map