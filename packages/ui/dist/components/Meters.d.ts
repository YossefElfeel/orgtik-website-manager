import type { ReactNode } from "react";
/** How far a task has got (an upload, an import). `value` null means "working, amount unknown". */
export declare function Progress({ value, label, max, className }: {
    value: number | null;
    label: ReactNode;
    max?: number;
    className?: string;
}): import("react").JSX.Element;
/** A measurement in a known range (storage used, a score). Not for progress over time. */
export declare function Meter({ value, label, min, max, format, className }: {
    value: number;
    label: ReactNode;
    min?: number;
    max?: number;
    format?: Intl.NumberFormatOptions;
    className?: string;
}): import("react").JSX.Element;
export type LimitState = "ok" | "near" | "full" | "over";
/** The spec's limit states: OK below 80%, near from 80%, full at the limit, over past it. */
export declare function limitState(used: number, limit: number): LimitState;
/**
 * Use against a plan's limit (seats, storage, projects). The state is spoken, not only coloured,
 * and past 80% it says what to do next through `action` (e.g. "Add seats"). The bar never draws
 * past full; "over" says by how much.
 */
export declare function LimitMeter({ used, limit, label, unit, action, className, }: {
    used: number;
    limit: number;
    label: ReactNode;
    /** Formats the numbers, e.g. (n) => f.bytes(n) for storage. */
    unit?: (n: number) => string;
    action?: ReactNode;
    className?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=Meters.d.ts.map