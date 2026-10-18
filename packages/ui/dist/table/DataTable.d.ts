import { type ReactNode } from "react";
import { type ColumnDef, type OnChangeFn, type PaginationState, type Row, type RowSelectionState, type SortingState, type VisibilityState, type ColumnSizingState } from "@tanstack/react-table";
import { type ListStatus } from "../components/States.js";
declare module "@tanstack/react-table" {
    interface ColumnMeta<TData, TValue> {
        /** Numbers, money and dates: aligned to the reading end, with tabular digits. */
        numeric?: boolean;
        /** A CSS width for the column, e.g. "12rem" or "1%" (shrink to content). */
        width?: string;
        /**
         * Keep the cell on one line and cut it with an ellipsis. The column takes the spare width.
         * Wrap user text in dir="auto" so a Latin file name in an Arabic table is cut at its end.
         */
        truncate?: boolean;
        /** Let long text wrap (descriptions, notes). Cells stay on one line otherwise. */
        wrap?: boolean;
    }
}
type StateCopy = {
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
};
export type DataTableProps<T> = {
    columns: ColumnDef<T, any>[];
    data: T[];
    /** A stable id per row, so selection survives paging and refetches. */
    getRowId: (row: T) => string;
    /** The accessible name of the table, e.g. "Files in Q3 reports". */
    label: string;
    /** loading before the first answer; ready otherwise. A refetch keeps showing the old rows. */
    status?: ListStatus;
    empty: StateCopy;
    error?: StateCopy;
    forbidden?: StateCopy;
    onRetry?: () => void;
    /**
     * client: sorts and pages `data` itself. server: `data` is the current page and the parent
     * fetches when sorting or paging changes (pass rowCount, sorting and pagination).
     */
    mode?: "client" | "server";
    rowCount?: number;
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
    pagination?: PaginationState;
    onPaginationChange?: OnChangeFn<PaginationState>;
    pageSizes?: number[];
    /** Turn paging off for short, bounded lists. */
    paginate?: boolean;
    /** Adds a checkbox column and, when rows are chosen, the bulk-action bar. */
    selectable?: boolean;
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: OnChangeFn<RowSelectionState>;
    /** The bulk actions for the chosen rows. Destructive ones should open a ConfirmDialog. */
    bulkActions?: (rows: Row<T>[]) => ReactNode;
    className?: string;
    density?: "comfortable" | "compact";
    stickyHeader?: boolean;
    columnChooser?: boolean;
    columnVisibility?: VisibilityState;
    onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
    resizable?: boolean;
    columnSizing?: ColumnSizingState;
    onColumnSizingChange?: OnChangeFn<ColumnSizingState>;
    rowActions?: (record: T) => ReactNode;
};
export declare function DataTable<T>({ columns, data, getRowId, label, status, empty, error, forbidden, onRetry, mode, rowCount, sorting: sortingProp, onSortingChange, pagination: paginationProp, onPaginationChange, pageSizes, paginate, selectable, rowSelection: selectionProp, onRowSelectionChange, bulkActions, className, density, stickyHeader, columnChooser, columnVisibility: visibilityProp, onColumnVisibilityChange, resizable, columnSizing: sizingProp, onColumnSizingChange, rowActions, }: DataTableProps<T>): import("react").JSX.Element;
export type { ColumnDef, SortingState, PaginationState, RowSelectionState, Row } from "@tanstack/react-table";
//# sourceMappingURL=DataTable.d.ts.map