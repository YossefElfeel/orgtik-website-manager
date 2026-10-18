import type { ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { controlFrame } from "../lib/control.js";
export type SelectOption<V extends string = string> = {
    value: V;
    label: ReactNode;
    disabled?: boolean;
};
export type SelectGroup<V extends string = string> = {
    label: ReactNode;
    options: SelectOption<V>[];
};
export type SelectProps<V extends string = string> = VariantProps<typeof controlFrame> & {
    /** The choices, flat or in labelled groups. */
    options: Array<SelectOption<V> | SelectGroup<V>>;
    value?: V | null;
    defaultValue?: V | null;
    onValueChange?: (value: V | null) => void;
    placeholder?: ReactNode;
    /** Visible context for standalone filters, e.g. Status: All. */
    label?: ReactNode;
    name?: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    className?: string;
    "aria-label"?: string;
};
/** Picks one value from a short list. Past about 12 options, or for search, use a Combobox. */
export declare function Select<V extends string = string>({ options, value, defaultValue, onValueChange, placeholder, label, size, className, "aria-label": ariaLabel, ...props }: SelectProps<V>): import("react").JSX.Element;
//# sourceMappingURL=Select.d.ts.map