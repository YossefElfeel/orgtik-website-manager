"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Plugs, ArrowRight } from "@phosphor-icons/react";
import { Button } from "../components/Button.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "./strings.js";
export function ConnectCard({ title, description, actionLabel, onConnect, children, disabled }) {
    const { locale } = useOrgtik();
    return _jsxs("section", { className: "flex flex-wrap items-center gap-4 rounded-card border border-line bg-raised p-5 shadow-xs", children: [_jsx("span", { "aria-hidden": "true", className: "grid size-10 place-items-center rounded-field bg-brand-subtle text-fg-brand", children: _jsx(Plugs, { className: "size-6" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h3", { className: "text-body font-semibold", children: title }), _jsx("p", { className: "mt-1 text-body-sm text-fg-muted", children: description }), children] }), _jsx(Button, { size: "sm", variant: "secondary", shape: "control", disabled: disabled, endIcon: _jsx(ArrowRight, { className: "rtl:-scale-x-100" }), onClick: onConnect, children: actionLabel || suiteText(locale, "connect") })] });
}
//# sourceMappingURL=ConnectCard.js.map