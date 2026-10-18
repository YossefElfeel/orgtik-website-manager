"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { CheckCircle, Circle, WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { LOCALES, directionOf } from "../locale.js";
import { useStrings } from "../provider/OrgtikProvider.js";
const NATIVE = { en: "English", ar: "العربية", de: "Deutsch", fr: "Français", it: "Italiano" };
/**
 * One piece of text in several languages. Each language is a tab with its own state, so the
 * form shows at a glance what's done, what's required and missing, and what falls back. The
 * input takes that language's lang and direction.
 *
 * The pattern is D-014's proposal, which replaces the spec's side-by-side AR/EN inputs. It
 * waits for the PM's confirmation.
 */
export function LocalizedField({ label, value, onChange, locales = LOCALES, required = ["en", "ar"], fallback = "en", errors, multiline = false, description, className, }) {
    const t = useStrings();
    const id = useId();
    const [active, setActive] = useState(locales[0]);
    const inputRef = useRef(null);
    const firstError = locales.find((l) => errors?.[l]);
    // When errors arrive, open the first language that has one and put the cursor there.
    useEffect(() => {
        if (firstError) {
            setActive(firstError);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [firstError]);
    const state = (l) => (errors?.[l] ? "error" : value[l]?.trim() ? "done" : required.includes(l) ? "missing" : "fallback");
    const done = locales.filter((l) => state(l) === "done").length;
    const Control = multiline ? "textarea" : "input";
    return (_jsxs("div", { role: "group", "aria-labelledby": `${id}-label`, className: cn("flex flex-col gap-2", className), children: [_jsxs("div", { className: "flex flex-wrap items-baseline justify-between gap-2", children: [_jsx("span", { id: `${id}-label`, className: "text-label text-fg", children: label }), _jsx("span", { className: "text-caption text-fg-muted tabular-nums", children: t("translatedCount", { done, total: locales.length }) })] }), _jsxs(BaseTabs.Root, { value: active, onValueChange: (v) => setActive(v), children: [_jsx(BaseTabs.List, { "aria-label": t("language"), className: "flex flex-wrap gap-1", children: locales.map((l) => {
                            const s = state(l);
                            return (_jsxs(BaseTabs.Tab, { value: l, className: cn("inline-flex h-8 items-center gap-1.5 rounded-pill bg-sunken px-3 text-body-sm font-semibold text-fg-muted transition-colors hover:text-fg", "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", "data-[active]:bg-action-primary data-[active]:text-on-action-primary"), children: [_jsx("span", { lang: l, dir: l === "ar" ? "rtl" : "ltr", children: NATIVE[l] }), _jsx("span", { "aria-hidden": "true", className: cn("[&_svg]:size-3.5", 
                                        // On the active (filled) tab the icon takes the tab's own colour.
                                        active !== l && (s === "done" ? "text-success" : s === "error" || s === "missing" ? "text-danger" : "text-fg-subtle")), children: s === "done" ? _jsx(CheckCircle, { weight: "fill" }) : s === "error" || s === "missing" ? _jsx(WarningCircle, { weight: "fill" }) : _jsx(Circle, {}) }), _jsx("span", { className: "sr-only", children: s === "done" ? t("localeDone") : s === "error" ? errors?.[l] : s === "missing" ? t("localeMissing") : t("localeFallback", { language: NATIVE[fallback] }) })] }, l));
                        }) }), _jsxs(BaseTabs.Panel, { value: active, className: "mt-2 flex flex-col gap-1.5", children: [_jsx(Control, { ref: inputRef, lang: active, dir: directionOf(active), "aria-label": `${label} (${NATIVE[active]})`, "aria-invalid": errors?.[active] ? true : undefined, "aria-required": required.includes(active) || undefined, value: value[active] ?? "", placeholder: state(active) === "fallback" && value[fallback] ? value[fallback] : undefined, onChange: (e) => onChange({ ...value, [active]: e.target.value }), rows: multiline ? 3 : undefined, className: cn("w-full rounded-field border border-line-control bg-raised px-3 text-body text-fg outline-hidden placeholder:text-fg-subtle hover:border-fg-subtle", "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus aria-invalid:border-danger", multiline ? "min-h-20 resize-y py-2" : "h-control-md") }, active), errors?.[active] ? (_jsxs("p", { className: "flex items-center gap-1 text-caption text-danger", children: [_jsx(WarningCircle, { "aria-hidden": "true", weight: "fill", className: "size-[1.1em]" }), errors[active]] })) : state(active) === "fallback" ? (_jsx("p", { className: "text-caption text-fg-subtle", children: t("localeFallback", { language: NATIVE[fallback] }) })) : description ? (_jsx("p", { className: "text-caption text-fg-muted", children: description })) : null] })] })] }));
}
//# sourceMappingURL=LocalizedField.js.map