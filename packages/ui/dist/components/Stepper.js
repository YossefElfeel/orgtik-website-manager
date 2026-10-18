"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// The steps of a wizard (Marketing's campaign wizard, post composer and account connection; HR's
// onboarding). A reached step is a real control and an unreached one says why it can't be opened
// yet; every state is in words, not only colour. Routing and saving are the app's: onStepClick says
// which step was asked for.
import { Fragment } from "react";
import { Check, WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./Menu.js";
import { Tooltip } from "./Popover.js";
const reached = (s) => s.state !== "upcoming";
export function Stepper({ steps, onStepClick, lockedHint, label, className }) {
    const t = useStrings();
    const total = steps.length;
    const currentIndex = Math.max(0, steps.findIndex((s) => s.state === "current"));
    const current = steps[currentIndex];
    const stateText = (s) => (s.state === "complete" ? t("stepComplete") : s.state === "error" ? t("stepError") : s.state === "current" ? t("stepCurrent") : t("stepUpcoming"));
    return (_jsxs("nav", { "aria-label": label, className: className, children: [_jsxs("div", { className: "flex items-center justify-between gap-3 md:hidden", children: [_jsxs("p", { className: "min-w-0 text-body text-fg", children: [_jsx("span", { className: "text-fg-muted", children: t("stepOf", { n: currentIndex + 1, total }) }), _jsx("span", { "aria-hidden": true, children: " \u00B7 " }), _jsx("span", { className: "font-semibold", children: current?.label })] }), _jsxs(Menu, { children: [_jsx(MenuTrigger, { className: "shrink-0 rounded-pill px-3 py-1.5 text-body-sm font-semibold text-fg-brand hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus", children: t("allSteps") }), _jsx(MenuContent, { align: "end", children: steps.map((s, i) => (_jsxs(MenuItem, { disabled: !reached(s), onClick: () => reached(s) && onStepClick?.(s.id), children: [t("stepOf", { n: i + 1, total }), " \u00B7 ", s.label, " (", stateText(s), ")"] }, s.id))) })] })] }), _jsx("ol", { className: "hidden items-start gap-2 md:flex", children: steps.map((s, i) => {
                    const marker = (_jsx("span", { "aria-hidden": true, className: cn("grid size-7 shrink-0 place-items-center rounded-pill border text-caption font-semibold tabular-nums", s.state === "complete" && "border-action-primary bg-action-primary text-on-action-primary", s.state === "current" && "border-action-primary bg-brand-subtle text-fg-brand", s.state === "upcoming" && "border-line-strong bg-raised text-fg-muted", s.state === "error" && "border-danger bg-danger-subtle text-danger"), children: s.state === "complete" ? _jsx(Check, { weight: "bold" }) : s.state === "error" ? _jsx(WarningCircle, { weight: "bold" }) : i + 1 }));
                    const text = (_jsxs("span", { className: "flex min-w-0 flex-col text-start", children: [_jsx("span", { className: cn("truncate text-body-sm", s.state === "current" ? "font-semibold text-fg" : "text-fg-muted", s.state === "error" && "text-danger"), children: s.label }), s.optional ? _jsx("span", { className: "text-micro text-fg-subtle", children: t("stepOptional") }) : null] }));
                    const sr = _jsx("span", { className: "sr-only", children: `${t("stepOf", { n: i + 1, total })}, ${stateText(s)}` });
                    const body = reached(s) ? (_jsxs("button", { type: "button", "aria-current": s.state === "current" ? "step" : undefined, onClick: () => onStepClick?.(s.id), className: "flex min-w-0 items-center gap-2 rounded-field p-1 hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus", children: [marker, text, sr] })) : (_jsx(Tooltip, { content: lockedHint ?? t("stepLocked"), children: _jsxs("span", { role: "link", "aria-disabled": "true", tabIndex: 0, className: "flex min-w-0 cursor-not-allowed items-center gap-2 rounded-field p-1 focus-visible:outline-2 focus-visible:outline-focus", children: [marker, text, sr] }) }));
                    return (_jsx(Fragment, { children: _jsxs("li", { className: "flex min-w-0 flex-1 items-center gap-2", children: [body, i < total - 1 ? _jsx("span", { "aria-hidden": true, className: cn("h-px min-w-4 flex-1", s.state === "complete" ? "bg-action-primary" : "bg-line") }) : null] }) }, s.id));
                }) })] }));
}
//# sourceMappingURL=Stepper.js.map