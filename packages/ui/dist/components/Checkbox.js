"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check, Minus } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
export const Checkbox = forwardRef(function Checkbox({ label, description, className, ...props }, ref) {
    const box = (_jsx(BaseCheckbox.Root, { ref: ref, className: cn("grid size-[18px] shrink-0 place-items-center rounded-md border border-line-control bg-raised text-on-action-primary", "transition-colors duration-(--ot-duration-fast) ease-ot-out", "hover:border-fg-subtle", "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", "data-[checked]:border-action-primary data-[checked]:bg-action-primary", "data-[indeterminate]:border-action-primary data-[indeterminate]:bg-action-primary", "data-[invalid]:border-danger data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[readonly]:opacity-70", label ? "mt-[0.2em]" : null, label ? null : className), ...props, children: _jsx(BaseCheckbox.Indicator, { className: "grid place-items-center data-[unchecked]:hidden", children: props.indeterminate ? _jsx(Minus, { weight: "bold", className: "size-3" }) : _jsx(Check, { weight: "bold", className: "size-3" }) }) }));
    if (!label)
        return box;
    return (_jsxs("label", { className: cn("inline-flex items-start gap-2.5 text-body text-fg has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-60", className), children: [box, _jsxs("span", { className: "flex flex-col gap-0.5", children: [_jsx("span", { children: label }), description ? _jsx("span", { className: "text-caption text-fg-muted", children: description }) : null] })] }));
});
//# sourceMappingURL=Checkbox.js.map