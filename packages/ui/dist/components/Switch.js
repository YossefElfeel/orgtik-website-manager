"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "../lib/cn.js";
/**
 * An on/off setting that applies at once. For a choice saved with a form's Save button, use a
 * Checkbox instead. The thumb travels toward the reading end, so it mirrors in RTL.
 */
export const Switch = forwardRef(function Switch({ label, description, className, ...props }, ref) {
    const control = (_jsx(BaseSwitch.Root, { ref: ref, className: cn("relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill bg-line-control p-0.5", "transition-colors duration-(--ot-duration-base) ease-ot-out", "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", "data-[checked]:bg-action-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50", label ? null : className), ...props, children: _jsx(BaseSwitch.Thumb, { className: cn("block size-5 rounded-pill bg-on-action-primary shadow-raised", "transition-transform duration-(--ot-duration-base) ease-ot-out", "data-[checked]:translate-x-4 rtl:data-[checked]:-translate-x-4") }) }));
    if (!label)
        return control;
    return (_jsxs("label", { className: cn("inline-flex items-start gap-3 text-body text-fg has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-60", className), children: [control, _jsxs("span", { className: "flex flex-col gap-0.5 pt-px", children: [_jsx("span", { children: label }), description ? _jsx("span", { className: "text-caption text-fg-muted", children: description }) : null] })] }));
});
//# sourceMappingURL=Switch.js.map