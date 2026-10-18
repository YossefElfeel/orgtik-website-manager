"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { forwardRef, useState } from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import { Field as BaseField } from "@base-ui/react/field";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { controlFrame } from "../lib/control.js";
import { useStrings } from "../provider/OrgtikProvider.js";
// Addresses, links, phone numbers and numbers read left to right in every language, so their
// inputs stay LTR inside an RTL page (plan: bidi-safe inputs).
const LTR_TYPES = new Set(["email", "url", "tel", "number"]);
export const Input = forwardRef(function Input({ className, size, startIcon, endSlot, type = "text", dir, ...props }, ref) {
    return (_jsxs("div", { className: cn(controlFrame({ size }), "flex items-center gap-2 px-3", endSlot ? "pe-1" : null, className), children: [startIcon ? (_jsx("span", { "aria-hidden": "true", className: "grid shrink-0 place-items-center text-fg-subtle", children: startIcon })) : null, _jsx(BaseInput, { ref: ref, type: type, dir: dir ?? (LTR_TYPES.has(type) ? "ltr" : undefined), className: "h-full min-w-0 flex-1 bg-transparent text-start outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed", ...props }), endSlot ? _jsx("span", { className: "flex shrink-0 items-center", children: endSlot }) : null] }));
});
/** A password input with a show/hide toggle. The toggle is a real button with a spoken label. */
export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
    const t = useStrings();
    const [visible, setVisible] = useState(false);
    return (_jsx(Input, { ref: ref, ...props, type: visible ? "text" : "password", autoComplete: props.autoComplete ?? "current-password", endSlot: _jsx("button", { type: "button", onClick: () => setVisible((v) => !v), "aria-pressed": visible, "aria-label": visible ? t("hidePassword") : t("showPassword"), title: visible ? t("hidePassword") : t("showPassword"), disabled: props.disabled, className: "grid size-8 place-items-center rounded-pill text-fg-muted transition-colors hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus disabled:pointer-events-none", children: visible ? _jsx(EyeSlash, { "aria-hidden": "true", className: "size-[1.15em]" }) : _jsx(Eye, { "aria-hidden": "true", className: "size-[1.15em]" }) }) }));
});
/** Multi-line text. It grows with its content where the browser supports field-sizing. */
export const Textarea = forwardRef(function Textarea({ className, rows = 3, maxRows = 12, style, ...props }, ref) {
    return (
    // Rendered through Field.Control, so a surrounding Field's label and messages describe it.
    _jsx(BaseField.Control, { render: _jsx("textarea", { ref: ref, rows: rows, ...props }), style: { maxHeight: `calc(${maxRows} * 1.55em + 1rem)`, ...style }, className: cn(controlFrame({ size: null }), "block min-h-20 resize-y px-3 py-2 text-body leading-[1.55] [field-sizing:content] placeholder:text-fg-subtle", "outline-hidden focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus read-only:bg-sunken disabled:cursor-not-allowed disabled:opacity-50", className) }));
});
//# sourceMappingURL=Input.js.map