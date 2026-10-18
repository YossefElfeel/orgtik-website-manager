import { type ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { controlFrame } from "../lib/control.js";
export type ComboOption<V extends string = string> = {
    value: V;
    /** Text to match and show. Keep it plain text: typing filters on it. */
    label: string;
    /** A second line, e.g. an email next to a name. */
    hint?: string;
    disabled?: boolean;
};
type Common<V extends string> = VariantProps<typeof controlFrame> & {
    options: ComboOption<V>[];
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    "aria-label"?: string;
    /** Shown when nothing matches the typed text. */
    emptyText?: ReactNode;
    className?: string;
};
export type ComboboxProps<V extends string = string> = Common<V> & {
    value?: V | null;
    defaultValue?: V | null;
    onValueChange?: (value: V | null) => void;
};
/** Pick one from many by typing (people, folders, countries). For a short fixed list use Select. */
export declare function Combobox<V extends string = string>({ options, value, defaultValue, onValueChange, placeholder, size, emptyText, className, "aria-label": ariaLabel, ...props }: ComboboxProps<V>): import("react").JSX.Element;
export type MultiSelectProps<V extends string = string> = Common<V> & {
    value?: V[];
    defaultValue?: V[];
    onValueChange?: (value: V[]) => void;
};
/** Pick several (people to share with, tags). Chosen items show as removable chips. */
export declare function MultiSelect<V extends string = string>({ options, value, defaultValue, onValueChange, placeholder, size, emptyText, className, "aria-label": ariaLabel, ...props }: MultiSelectProps<V>): import("react").JSX.Element;
export {};
//# sourceMappingURL=Combobox.d.ts.map