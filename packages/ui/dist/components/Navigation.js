"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { formatLocale } from "../locale.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
import { Select } from "./Select.js";
// Tabs ---------------------------------------------------------------------------------------
export const Tabs = BaseTabs.Root;
export const TabsPanel = BaseTabs.Panel;
/**
 * The tab row. `line` sits on a page (an underline marks the current tab); `contained` sits
 * inside a card or toolbar; `side` is a column beside the panel, for more tabs than fit in a row
 * (put `orientation="vertical"` on <Tabs> so the arrow keys go up and down). Arrow keys follow the
 * reading direction (spike-verified).
 */
export function TabsList({ items, variant = "line", className }) {
    const { digits, locale } = useOrgtik();
    const count = new Intl.NumberFormat(formatLocale(locale, digits));
    const line = variant === "line";
    if (variant === "side")
        return (_jsx(BaseTabs.List, { className: cn("flex flex-col gap-0.5", className), children: items.map((item) => (_jsxs(BaseTabs.Tab, { value: item.value, disabled: item.disabled, className: cn("flex min-h-control-md w-full items-center justify-between gap-2 rounded-field px-3 py-2 text-start font-body text-body-sm text-fg-muted outline-hidden select-none", "transition-colors duration-(--ot-duration-fast) ease-ot-out hover:bg-hover hover:text-fg", "data-[active]:bg-brand-subtle data-[active]:font-semibold data-[active]:text-fg-brand", "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus data-[disabled]:pointer-events-none data-[disabled]:opacity-50"), children: [_jsx("span", { className: "min-w-0", children: item.label }), item.count !== undefined ? (_jsx("span", { className: "shrink-0 rounded-pill bg-sunken px-1.5 text-micro text-fg-muted tabular-nums", children: count.format(item.count) })) : null] }, item.value))) }));
    return (_jsxs(BaseTabs.List, { className: cn("relative flex max-w-full items-center overflow-x-auto", line ? "gap-5 border-b border-line" : "gap-1 rounded-pill bg-sunken p-1", className), children: [items.map((item) => (_jsxs(BaseTabs.Tab, { value: item.value, disabled: item.disabled, className: cn("relative z-[1] inline-flex shrink-0 items-center gap-2 font-body text-body font-semibold whitespace-nowrap text-fg-muted outline-hidden select-none", "transition-colors duration-(--ot-duration-fast) ease-ot-out hover:text-fg data-[active]:text-fg", "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[disabled]:pointer-events-none data-[disabled]:opacity-50", line ? "h-control-md" : "h-control-sm rounded-pill px-3.5"), children: [item.label, item.count !== undefined ? (_jsx("span", { className: "rounded-pill bg-sunken px-1.5 text-micro text-fg-muted tabular-nums", children: count.format(item.count) })) : null] }, item.value))), _jsx(BaseTabs.Indicator, { style: { left: "var(--active-tab-left)", width: "var(--active-tab-width)" }, className: cn("absolute transition-[left,width] duration-(--ot-duration-base) ease-ot-out", line ? "bottom-0 h-0.5 rounded-pill bg-fg-brand" : "top-1 h-[calc(100%-8px)] rounded-pill bg-raised shadow-raised") })] }));
}
// Pagination ---------------------------------------------------------------------------------
/** Page numbers to show: always the first and last, the current and its neighbours, gaps as null. */
export function pageWindow(page, pages) {
    if (pages <= 7)
        return Array.from({ length: pages }, (_, i) => i + 1);
    const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
    const sorted = [...set].sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1)
            out.push(p - sorted[i - 1] === 2 ? p - 1 : null);
        out.push(p);
    });
    return out;
}
export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizes = [10], hrefFor, className }) {
    const t = useStrings();
    const { Link } = useOrgtik();
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    const cell = "inline-grid h-control-sm min-w-control-sm place-items-center rounded-pill px-2 text-body-sm font-semibold tabular-nums text-fg transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus";
    const go = (target, content, label, extra) => {
        const disabled = target < 1 || target > pages;
        if (hrefFor && !disabled) {
            return (_jsxs(Link, { href: hrefFor(target), className: cn(cell, extra), children: [_jsx("span", { "aria-hidden": label ? "true" : undefined, children: content }), label ? _jsx("span", { className: "sr-only", children: label }) : null] }));
        }
        return (_jsx("button", { type: "button", "aria-label": label || undefined, disabled: disabled, onClick: () => onPageChange?.(target), className: cn(cell, "disabled:pointer-events-none disabled:opacity-40", extra), children: content }));
    };
    return (_jsxs("div", { className: cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-body-sm text-fg-muted", className), children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "tabular-nums", "aria-live": "polite", children: t("showingRange", { from, to, total }) }), onPageSizeChange ? (_jsxs("span", { className: "flex items-center gap-2", children: [_jsx("span", { children: t("rowsPerPage") }), _jsx(Select, { size: "sm", "aria-label": t("rowsPerPage"), value: String(pageSize), onValueChange: (v) => v && onPageSizeChange(Number(v)), options: pageSizes.map((n) => ({ value: String(n), label: String(n) })), className: "w-20" })] })) : null] }), _jsxs("nav", { "aria-label": t("pagination"), className: "flex items-center gap-1", children: [go(page - 1, _jsx(CaretLeft, { className: "size-4 rtl:-scale-x-100" }), t("previousPage")), pageWindow(page, pages).map((p, i) => p === null ? (_jsx("span", { "aria-hidden": "true", className: "px-1 text-fg-subtle", children: "\u2026" }, `gap-${i}`)) : p === page ? (_jsx("span", { "aria-current": "page", className: cn(cell, "bg-action-primary text-on-action-primary hover:bg-action-primary"), children: p }, p)) : (_jsx("span", { children: go(p, p, t("pageOf", { page: p, pages })) }, p))), go(page + 1, _jsx(CaretRight, { className: "size-4 rtl:-scale-x-100" }), t("nextPage"))] })] }));
}
/** Where this page sits. The last crumb is the current page; the rest link up. */
export function Breadcrumb({ items, className }) {
    const t = useStrings();
    const { Link } = useOrgtik();
    return (_jsx("nav", { "aria-label": t("breadcrumb"), className: className, children: _jsx("ol", { className: "flex flex-wrap items-center gap-1.5 text-body-sm text-fg-muted", children: items.map((c, i) => {
                const last = i === items.length - 1;
                return (_jsxs("li", { className: "flex min-w-0 items-center gap-1.5", children: [last || !c.href ? (_jsx("span", { "aria-current": last ? "page" : undefined, className: cn("truncate", last && "text-fg"), children: c.label })) : (_jsx(Link, { href: c.href, className: "truncate rounded-sm hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus", children: c.label })), last ? null : _jsx(CaretRight, { "aria-hidden": "true", className: "size-3 shrink-0 text-fg-subtle rtl:-scale-x-100" })] }, i));
            }) }) }));
}
export function PageHeader({ title, description, breadcrumb, status, meta, tabs, actions, className }) {
    return (_jsxs("header", { className: cn("flex flex-col gap-3", className), children: [breadcrumb?.length ? _jsx(Breadcrumb, { items: breadcrumb }) : null, _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-x-6 gap-y-3", children: [_jsxs("div", { className: "flex min-w-0 flex-col gap-1.5", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("h1", { className: "font-display text-title-lg text-fg", children: title }), status] }), description ? _jsx("p", { className: "max-w-[70ch] text-body text-fg-muted", children: description }) : null, meta ? _jsx("div", { className: "flex flex-wrap items-center gap-3 text-caption text-fg-subtle", children: meta }) : null] }), actions ? _jsx("div", { className: "flex flex-wrap items-center gap-2", children: actions }) : null] }), tabs] }));
}
//# sourceMappingURL=Navigation.js.map