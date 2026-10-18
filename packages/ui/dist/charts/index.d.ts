import { type ReactNode } from "react";
export type ChartSeries = {
    key: string;
    label: string;
    /** Which palette colour (1–8). Default: its place in the list. */
    color?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    /** A dashed line (a comparison, a target), so two series differ by more than colour. Lines only. */
    dashed?: boolean;
};
type Datum = Record<string, string | number | null>;
type Common = {
    title: ReactNode;
    description?: ReactNode;
    /** Controls beside the title (a period switch). */
    actions?: ReactNode;
    loading?: boolean;
    error?: boolean;
    onRetry?: () => void;
    /** What an empty chart says; defaults to the library's "No data for this period yet." */
    emptyText?: ReactNode;
    height?: number;
    /** How values read (on the axis, in the tooltip and the table). */
    valueFormat?: Intl.NumberFormatOptions;
    className?: string;
    /** Align chart areas when cards have different amounts of heading copy. */
    headerMinHeight?: number;
};
type Cartesian = Common & {
    data: Datum[];
    /** The category or time field, and how its values read. */
    x: {
        key: string;
        label: string;
        format?: (v: string | number) => string;
    };
    series: ChartSeries[];
};
/** Change over time: one line per series; `area` fills under a single series. */
export declare function LineChart({ data, x, series, area, ...common }: Cartesian & {
    area?: boolean;
}): import("react").JSX.Element;
/** Amounts by category: columns, or `layout="rows"` for long names (a ranking). */
export declare function BarChart({ data, x, series, stacked, layout, labelWidth, maxBarSize, ...common }: Cartesian & {
    stacked?: boolean;
    layout?: "columns" | "rows";
    /** Space for row labels; use less for short categories such as page paths. */
    labelWidth?: number;
    /** Keeps bars readable when charts with different category counts share a height. */
    maxBarSize?: number;
}): import("react").JSX.Element;
/** Parts of a whole (up to about six): a ring with the total in the middle. */
export declare function DonutChart({ data, totalLabel, categoryLabel, valueLabel, ...common }: Common & {
    data: {
        key: string;
        label: string;
        value: number;
    }[];
    totalLabel?: ReactNode;
    /** The table's column names: what the parts are ("Channel") and what's counted ("Leads"). */
    categoryLabel: string;
    valueLabel: string;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=index.d.ts.map