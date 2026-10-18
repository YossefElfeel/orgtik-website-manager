import type { ReactNode } from "react";
/** A label on an object (a file's tags). With `onRemove` it gets a named remove button. */
export declare function Tag({ children, onRemove, className }: {
    children: ReactNode;
    onRemove?: () => void;
    className?: string;
}): import("react").JSX.Element;
export type FilterChip<V extends string = string> = {
    value: V;
    label: ReactNode;
    count?: number;
};
/**
 * Quick filters that combine (status: Open, Overdue). Each chip is a toggle that reports
 * aria-pressed; "Clear" appears once any is on.
 */
export declare function FilterChips<V extends string = string>({ chips, value, onValueChange, label, className, }: {
    chips: FilterChip<V>[];
    value: V[];
    onValueChange: (value: V[]) => void;
    /** What the chips filter, e.g. "Status". */
    label: string;
    className?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=Chips.d.ts.map