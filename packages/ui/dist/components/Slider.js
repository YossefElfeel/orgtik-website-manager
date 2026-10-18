"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from "react";
export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, disabled, format = String }) {
    const id = useId();
    return _jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("label", { htmlFor: id, className: "text-body-sm font-semibold", children: label }), _jsx("output", { htmlFor: id, className: "text-body-sm tabular-nums text-fg-muted", children: format(value) })] }), _jsx("input", { id: id, type: "range", className: "h-5 w-full accent-[var(--ot-action-primary-bg)] disabled:opacity-50", value: value, min: min, max: max, step: step, disabled: disabled, "aria-valuetext": format(value), onChange: event => onChange(Number(event.target.value)) })] });
}
//# sourceMappingURL=Slider.js.map