"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check, X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";
/** A label on an object (a file's tags). With `onRemove` it gets a named remove button. */
export function Tag({ children, onRemove, className }) {
    const t = useStrings();
    const text = typeof children === "string" ? children : "";
    return (_jsxs("span", { className: cn("inline-flex h-7 max-w-full items-center gap-1 rounded-pill border border-line bg-raised ps-2.5 text-body-sm text-fg", onRemove ? "pe-1" : "pe-2.5", className), children: [_jsx("span", { dir: "auto", className: "truncate", children: children }), onRemove ? (_jsx("button", { type: "button", onClick: onRemove, "aria-label": t("removeItem", { label: text }), className: "grid size-5 shrink-0 place-items-center rounded-pill text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus", children: _jsx(X, { "aria-hidden": "true", className: "size-3" }) })) : null] }));
}
/**
 * Quick filters that combine (status: Open, Overdue). Each chip is a toggle that reports
 * aria-pressed; "Clear" appears once any is on.
 */
export function FilterChips({ chips, value, onValueChange, label, className, }) {
    const t = useStrings();
    const on = new Set(value);
    return (_jsxs("div", { role: "group", "aria-label": label, className: cn("flex flex-wrap items-center gap-2", className), children: [chips.map((c) => {
                const pressed = on.has(c.value);
                return (_jsxs("button", { type: "button", "aria-pressed": pressed, onClick: () => onValueChange(pressed ? value.filter((v) => v !== c.value) : [...value, c.value]), className: cn("inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-body-sm font-semibold transition-colors duration-(--ot-duration-fast)", "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", pressed ? "border-action-primary bg-brand-subtle text-fg-brand" : "border-line-control text-fg-muted hover:bg-hover hover:text-fg"), children: [pressed ? _jsx(Check, { "aria-hidden": "true", weight: "bold", className: "size-3.5" }) : null, c.label, c.count !== undefined ? _jsx("span", { className: "text-caption font-normal tabular-nums opacity-80", children: c.count }) : null] }, c.value));
            }), value.length ? (_jsx("button", { type: "button", onClick: () => onValueChange([]), className: "h-8 rounded-pill px-2 text-body-sm text-fg-muted hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus", children: t("clear") })) : null] }));
}
//# sourceMappingURL=Chips.js.map