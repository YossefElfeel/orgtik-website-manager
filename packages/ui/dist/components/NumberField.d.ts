import type { VariantProps } from "class-variance-authority";
import { controlFrame } from "../lib/control.js";
export type NumberFieldProps = VariantProps<typeof controlFrame> & {
    value?: number | null;
    defaultValue?: number;
    onValueChange?: (value: number | null) => void;
    min?: number;
    max?: number;
    step?: number;
    /** Show − and + buttons (default). Off for amounts where stepping makes no sense. */
    steppers?: boolean;
    name?: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    "aria-label"?: string;
    className?: string;
    /** Intl options: the value is shown and parsed in the person's language and digits (D-016). */
    format?: Intl.NumberFormatOptions;
};
/**
 * A number, typed or stepped (arrow keys, − and +). It formats as the person's language writes
 * numbers, parses what they type back, and reads left to right inside RTL pages.
 */
export declare function NumberField({ steppers, size, className, format, "aria-label": ariaLabel, ...props }: NumberFieldProps): import("react").JSX.Element;
export type MoneyFieldProps = Omit<NumberFieldProps, "format" | "step" | "steppers"> & {
    /** ISO 4217. The minor units follow it: CHF and SAR 2, KWD 3, JPY 0. */
    currency: string;
};
/** An amount of money in one currency, with the currency's own decimals. No steppers. */
export declare function MoneyField({ currency, ...props }: MoneyFieldProps): import("react").JSX.Element;
export type PercentFieldProps = Omit<NumberFieldProps, "format" | "min" | "max"> & {
    min?: number;
    max?: number;
    decimals?: number;
};
/** A percentage, in points (12 means 12%), 0–100 unless said otherwise. For discounts and rates. */
export declare function PercentField({ decimals, min, max, step, ...props }: PercentFieldProps): import("react").JSX.Element;
//# sourceMappingURL=NumberField.d.ts.map