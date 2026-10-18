import type { ReactNode } from "react";
export type RadioOption<V extends string = string> = {
    value: V;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
};
export type RadioGroupProps<V extends string = string> = {
    options: RadioOption<V>[];
    value?: V;
    defaultValue?: V;
    onValueChange?: (value: V) => void;
    name?: string;
    disabled?: boolean;
    required?: boolean;
    /** Stack the options (default) or lay them in a row. */
    orientation?: "vertical" | "horizontal";
    /** The group's name for assistive tech when no Field label names it. */
    "aria-label"?: string;
    className?: string;
};
/**
 * One choice from a few (up to about five), all visible. Arrow keys move between options in the
 * reading direction. For many options use Select; for a view switch use SegmentedControl.
 */
export declare function RadioGroup<V extends string = string>({ options, onValueChange, orientation, className, ...props }: RadioGroupProps<V>): import("react").JSX.Element;
export type Segment<V extends string = string> = {
    value: V;
    label: ReactNode;
    icon?: ReactNode;
    disabled?: boolean;
};
export type SegmentedControlProps<V extends string = string> = {
    segments: Segment<V>[];
    value: V;
    onValueChange: (value: V) => void;
    /** What the control switches, e.g. "View". Required: the group needs a name. */
    label: string;
    size?: "sm" | "md";
    /** Icons only; each segment's label becomes its spoken name. */
    iconOnly?: boolean;
    className?: string;
};
/**
 * One of a few mutually exclusive modes, applied at once (list/grid, day/week/month). Each segment
 * reports aria-pressed, so the current one is announced (the Files audit found five switches
 * that didn't say which option was on).
 */
export declare function SegmentedControl<V extends string = string>({ segments, value, onValueChange, label, size, iconOnly, className }: SegmentedControlProps<V>): import("react").JSX.Element;
//# sourceMappingURL=Choice.d.ts.map