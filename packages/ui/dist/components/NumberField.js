"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { Minus, Plus } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { controlFrame } from "../lib/control.js";
import { formatLocale } from "../locale.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
/**
 * A number, typed or stepped (arrow keys, − and +). It formats as the person's language writes
 * numbers, parses what they type back, and reads left to right inside RTL pages.
 */
export function NumberField({ steppers = true, size, className, format, "aria-label": ariaLabel, ...props }) {
    const { locale, digits } = useOrgtik();
    const t = useStrings();
    const stepper = "grid h-full w-9 shrink-0 place-items-center text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-40";
    return (_jsx(BaseNumberField.Root, { locale: formatLocale(locale, digits), format: format, ...props, children: _jsxs(BaseNumberField.Group, { dir: "ltr", className: cn(controlFrame({ size }), "flex items-stretch overflow-hidden", className), children: [steppers ? (_jsx(BaseNumberField.Decrement, { "aria-label": t("decrease"), className: cn(stepper, "border-e border-line"), children: _jsx(Minus, { "aria-hidden": "true", className: "size-3.5" }) })) : null, _jsx(BaseNumberField.Input, { "aria-label": ariaLabel, className: "min-w-0 flex-1 bg-transparent px-3 text-start tabular-nums outline-none" }), steppers ? (_jsx(BaseNumberField.Increment, { "aria-label": t("increase"), className: cn(stepper, "border-s border-line"), children: _jsx(Plus, { "aria-hidden": "true", className: "size-3.5" }) })) : null] }) }));
}
/** An amount of money in one currency, with the currency's own decimals. No steppers. */
export function MoneyField({ currency, ...props }) {
    const places = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return (_jsx(NumberField, { ...props, steppers: false, step: 1 / 10 ** places, min: props.min ?? 0, format: { style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: places, maximumFractionDigits: places } }));
}
/** A percentage, in points (12 means 12%), 0–100 unless said otherwise. For discounts and rates. */
export function PercentField({ decimals = 0, min = 0, max = 100, step = 1, ...props }) {
    return _jsx(NumberField, { ...props, min: min, max: max, step: step, format: { style: "unit", unit: "percent", maximumFractionDigits: decimals } });
}
//# sourceMappingURL=NumberField.js.map