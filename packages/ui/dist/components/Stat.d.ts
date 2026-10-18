import type { ReactNode } from "react";
export type StatChange = {
    /** The change as a ratio (0.12 is +12%), or an absolute amount with `format: "number"`. */
    value: number;
    format?: "percent" | "number";
    /** Which way is good news: visits up is good, response time up is not. Default "up". */
    good?: "up" | "down";
    /** What it's compared with ("vs the previous 30 days"). */
    against?: ReactNode;
};
/**
 * One figure with its label and, optionally, how it moved. The change says its direction in words
 * as well as with an arrow and a tone, so it doesn't depend on colour.
 */
export declare function Stat({ label, value, change, hint, icon, loading, className, sparkline, }: {
    label: ReactNode;
    value: ReactNode;
    change?: StatChange;
    hint?: ReactNode;
    icon?: ReactNode;
    loading?: boolean;
    className?: string;
    sparkline?: number[];
}): import("react").JSX.Element;
//# sourceMappingURL=Stat.d.ts.map