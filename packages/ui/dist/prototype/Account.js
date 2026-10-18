"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { Button } from "../components/Button.js";
import { Badge } from "../components/Badge.js";
import { Field } from "../components/Field.js";
import { Input } from "../components/Input.js";
import { EmptyState } from "../components/States.js";
import { SimulatedTag } from "../demo/DemoPanel.js";
import { prototypeWord } from "./strings.js";
import { cn } from "../lib/cn.js";
export function UsageMeter({ label, used, limit, unit, warnings = true, valueText }) {
    const { locale } = useOrgtik(), percent = limit > 0 ? Math.min(100, Math.max(0, used / limit * 100)) : 100;
    const f = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const status = warnings ? used >= limit ? "reached" : percent >= 80 ? "approaching" : null : null;
    return _jsxs("div", { className: "flex flex-col gap-2 py-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("span", { className: "text-body font-semibold", children: label }), _jsx("span", { className: "text-body-sm tabular-nums text-fg-muted", children: valueText ?? `${f.format(used)} ${prototypeWord(locale, "usedOf")} ${f.format(limit)} ${unit ?? ""}` })] }), _jsx("div", { role: "progressbar", "aria-label": label, "aria-valuenow": Math.min(limit, Math.max(0, used)), "aria-valuemin": 0, "aria-valuemax": limit, "aria-valuetext": `${f.format(used)} / ${f.format(limit)} ${unit ?? ""}`, className: "h-2 overflow-hidden rounded-pill bg-sunken", children: _jsx("div", { className: cn("h-full rounded-pill", status === "reached" ? "bg-danger" : status === "approaching" ? "bg-warning" : "bg-action-primary"), style: { width: `${percent}%` } }) }), status ? _jsx("p", { className: cn("text-caption", status === "reached" ? "text-danger" : "text-fg-muted"), children: prototypeWord(locale, status) }) : null] });
}
export function AuditLogTable({ entries }) {
    const { locale } = useOrgtik(), [query, setQuery] = useState("");
    const visible = entries.filter(entry => `${entry.actor} ${entry.action} ${entry.target}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    const t = (key) => prototypeWord(locale, key);
    return _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(Field, { label: t("search"), children: _jsx(Input, { value: query, onChange: event => setQuery(event.target.value) }) }), visible.length ? _jsx("div", { className: "overflow-x-auto rounded-panel border border-line", children: _jsxs("table", { className: "w-full text-start text-body-sm", children: [_jsx("caption", { className: "sr-only", children: t("audit") }), _jsx("thead", { className: "bg-sunken text-fg-muted", children: _jsx("tr", { children: ["actor", "action", "target", "when"].map(key => _jsx("th", { scope: "col", className: "px-4 py-3 text-start font-semibold", children: t(key) }, key)) }) }), _jsx("tbody", { className: "divide-y divide-line", children: visible.map(entry => _jsxs("tr", { children: [_jsx("td", { className: "px-4 py-3 whitespace-nowrap", dir: "auto", children: entry.actor }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { children: entry.action }), entry.simulated ? _jsx(SimulatedTag, {}) : null] }) }), _jsx("td", { className: "px-4 py-3", dir: "auto", children: entry.target }), _jsx("td", { className: "px-4 py-3 whitespace-nowrap tabular-nums", children: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(entry.at)) })] }, entry.id)) })] }) }) : _jsx(EmptyState, { title: t("noActivity"), size: "compact" })] });
}
/** Pure presentation flow: the code is fixed and no identity/session API is called. */
export function TwoFactorScreens({ enabled, onChange }) {
    const { locale } = useOrgtik(), [step, setStep] = useState("overview"), [code, setCode] = useState(""), [error, setError] = useState(false);
    const t = (key) => prototypeWord(locale, key);
    const download = () => { const blob = new Blob(["OrgTik simulated recovery examples — no account access\nDEMO-1111\nDEMO-2222\nDEMO-3333\n"], { type: "text/plain;charset=utf-8" }), url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "orgtik-demo-recovery.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    return _jsxs("section", { "aria-label": t("twoFactor"), className: "flex flex-col gap-4 rounded-panel border border-line bg-raised p-5", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(ShieldCheck, { "aria-hidden": "true", className: "size-5 text-fg-brand" }), _jsx("h2", { className: "font-display text-title-sm", children: t("twoFactor") }), _jsx(SimulatedTag, {})] }), _jsx("p", { className: "max-w-prose text-body text-fg-muted", children: t("twoFactorNote") }), step === "overview" ? _jsxs(_Fragment, { children: [_jsx(Badge, { className: "self-start", tone: enabled ? "success" : "neutral", children: t(enabled ? "enabled" : "disabled") }), _jsx("div", { children: _jsx(Button, { variant: enabled ? "secondary" : "primary", onClick: () => { if (enabled)
                                onChange(false);
                            else {
                                setCode("");
                                setError(false);
                                setStep("code");
                            } }, children: t(enabled ? "disable" : "setup") }) })] }) : null, step === "code" ? _jsxs("form", { className: "flex max-w-md flex-col gap-4", onSubmit: event => { event.preventDefault(); if (code !== "123456") {
                    setError(true);
                    return;
                } onChange(true); setStep("recovery"); }, children: [_jsx(Field, { label: t("code"), description: t("codeHelp"), error: error ? t("codeError") : undefined, children: _jsx(Input, { dir: "ltr", inputMode: "numeric", autoComplete: "off", maxLength: 6, value: code, onChange: event => { setCode(event.target.value); setError(false); } }) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { type: "submit", children: t("verify") }), _jsx(Button, { variant: "secondary", onClick: () => setStep("overview"), children: t("cancel") })] })] }) : null, step === "recovery" ? _jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(CheckCircle, { "aria-hidden": "true", className: "size-5 text-success" }), _jsx("h3", { className: "text-body font-semibold", children: t("recovery") })] }), _jsx("p", { className: "max-w-prose text-body-sm text-fg-muted", children: t("recoveryHelp") }), _jsx("div", { dir: "ltr", className: "flex flex-wrap gap-2", children: ["DEMO-1111", "DEMO-2222", "DEMO-3333"].map(value => _jsx("code", { className: "rounded-field bg-sunken px-3 py-2 text-body-sm", children: value }, value)) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: "secondary", onClick: download, children: t("download") }), _jsx(Button, { onClick: () => setStep("overview"), children: t("done") })] })] }) : null] });
}
//# sourceMappingURL=Account.js.map