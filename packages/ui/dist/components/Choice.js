"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import { cn } from "../lib/cn.js";
/**
 * One choice from a few (up to about five), all visible. Arrow keys move between options in the
 * reading direction. For many options use Select; for a view switch use SegmentedControl.
 */
export function RadioGroup({ options, onValueChange, orientation = "vertical", className, ...props }) {
    return (_jsx(BaseRadioGroup, { onValueChange: (v) => onValueChange?.(v), className: cn("flex gap-3", orientation === "vertical" ? "flex-col" : "flex-row flex-wrap gap-x-6", className), ...props, children: options.map((o) => (_jsxs("label", { className: "inline-flex items-start gap-2.5 text-body text-fg has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-60", children: [_jsx(Radio.Root, { value: o.value, disabled: o.disabled, className: cn("mt-[0.2em] grid size-[18px] shrink-0 place-items-center rounded-pill border border-line-control bg-raised", "transition-colors duration-(--ot-duration-fast) ease-ot-out hover:border-fg-subtle", "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", "data-[checked]:border-action-primary data-[invalid]:border-danger"), children: _jsx(Radio.Indicator, { className: "block size-2.5 rounded-pill bg-action-primary data-[unchecked]:hidden" }) }), _jsxs("span", { className: "flex flex-col gap-0.5", children: [_jsx("span", { children: o.label }), o.description ? _jsx("span", { className: "text-caption text-fg-muted", children: o.description }) : null] })] }, o.value))) }));
}
/**
 * One of a few mutually exclusive modes, applied at once (list/grid, day/week/month). Each segment
 * reports aria-pressed, so the current one is announced (the Files audit found five switches
 * that didn't say which option was on).
 */
export function SegmentedControl({ segments, value, onValueChange, label, size = "md", iconOnly = false, className }) {
    return (_jsx(ToggleGroup, { "aria-label": label, value: [value], onValueChange: (next) => {
            // A segmented control always has one choice: pressing the current one keeps it.
            const picked = next.find((v) => v !== value) ?? value;
            if (picked !== value)
                onValueChange(picked);
        }, className: cn("inline-flex items-center gap-1 rounded-pill bg-sunken p-1", className), children: segments.map((s) => (_jsxs(Toggle, { value: s.value, disabled: s.disabled, "aria-label": iconOnly && typeof s.label === "string" ? s.label : undefined, title: iconOnly && typeof s.label === "string" ? s.label : undefined, className: cn("inline-flex items-center justify-center gap-1.5 rounded-pill font-body font-semibold text-fg-muted select-none", "transition-colors duration-(--ot-duration-fast) ease-ot-out hover:text-fg", "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus", "data-[pressed]:bg-raised data-[pressed]:text-fg data-[pressed]:shadow-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-50", "[&_svg]:size-4 [&_svg]:shrink-0", size === "sm" ? "h-7 text-body-sm" : "h-8 text-body", iconOnly ? (size === "sm" ? "w-7" : "w-8") : "px-3"), children: [s.icon ? _jsx("span", { "aria-hidden": "true", className: "contents", children: s.icon }) : null, iconOnly ? null : s.label] }, s.value))) }));
}
//# sourceMappingURL=Choice.js.map