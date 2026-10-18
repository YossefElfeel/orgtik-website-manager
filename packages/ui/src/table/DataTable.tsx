"use client";
// DataTable, in its own entry (`@orgtik/ui/table`) so apps without TanStack Table never load it.
// It lifts HR's table behaviour (server paging, sort, selection, skeleton rows), not its styles.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { CaretDown, CaretUp, CaretUpDown, X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";
import { Checkbox } from "../components/Checkbox.js";
import { Skeleton } from "../components/Display.js";
import { Pagination } from "../components/Navigation.js";
import { EmptyState, ErrorState, NoPermissionState, type ListStatus } from "../components/States.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { ColumnChooser } from "../components/ColumnChooser.js";
import { suiteText } from "../suite/strings.js";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

type StateCopy = { title?: ReactNode; description?: ReactNode; action?: ReactNode };

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

export function DataTable<T>({
  columns,
  data,
  getRowId,
  label,
  status = "ready",
  empty,
  error,
  forbidden,
  onRetry,
  mode = "client",
  rowCount,
  sorting: sortingProp,
  onSortingChange,
  pagination: paginationProp,
  onPaginationChange,
  pageSizes = [10],
  paginate = true,
  selectable = false,
  rowSelection: selectionProp,
  onRowSelectionChange,
  bulkActions,
  className,
  density = "comfortable",
  stickyHeader = true,
  columnChooser = false,
  columnVisibility: visibilityProp,
  onColumnVisibilityChange,
  resizable = false,
  columnSizing: sizingProp,
  onColumnSizingChange,
  rowActions,
}: DataTableProps<T>) {
  const t = useStrings();
  const { locale, dir: readingDirection } = useOrgtik();
  // A table wider than its box scrolls sideways; then the box is a labelled region you can focus
  // and scroll with the keyboard (WCAG 2.1.1). A table that fits adds no extra tab stop.
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  const [innerSorting, setInnerSorting] = useState<SortingState>([]);
  const [innerPagination, setInnerPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: pageSizes[0] ?? 10 });
  const [innerSelection, setInnerSelection] = useState<RowSelectionState>({});
  const [innerVisibility, setInnerVisibility] = useState<VisibilityState>({});
  const [innerSizing, setInnerSizing] = useState<ColumnSizingState>({});
  const sorting = sortingProp ?? innerSorting;
  const pagination = paginationProp ?? innerPagination;
  const rowSelection = selectionProp ?? innerSelection;
  const server = mode === "server";

  const allColumns = useMemo<ColumnDef<T, any>[]>(() => {
    const fields: ColumnDef<T, any>[] = rowActions ? [...columns, { id: "__actions", header: suiteText(locale, "actions"), enableSorting: false, enableHiding: false, enableResizing: false, size: 64, meta: { width: "1%" }, cell: ({ row }) => rowActions(row.original) }] : columns;
    if (!selectable) return fields;
    const select: ColumnDef<T, any> = {
      id: "__select",
      enableHiding: false,
      enableResizing: false,
      size: 44,
      enableSorting: false,
      meta: { width: "1%" },
      header: ({ table }) => (
        <Checkbox
          aria-label={t("selectAll")}
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox aria-label={t("selectRow")} checked={row.getIsSelected()} disabled={!row.getCanSelect()} onCheckedChange={(v) => row.toggleSelected(Boolean(v))} />
      ),
    };
    return [select, ...fields];
  }, [columns, selectable, t, rowActions, locale]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: { sorting, pagination, rowSelection, columnVisibility: visibilityProp ?? innerVisibility, columnSizing: sizingProp ?? innerSizing },
    onSortingChange: onSortingChange ?? setInnerSorting,
    onPaginationChange: onPaginationChange ?? setInnerPagination,
    onRowSelectionChange: onRowSelectionChange ?? setInnerSelection,
    onColumnVisibilityChange: onColumnVisibilityChange ?? setInnerVisibility,
    onColumnSizingChange: onColumnSizingChange ?? setInnerSizing,
    enableColumnResizing: resizable,
    columnResizeMode: "onChange",
    columnResizeDirection: readingDirection,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    ...(server
      ? { manualSorting: true, manualPagination: true, rowCount: rowCount ?? data.length }
      : { getSortedRowModel: getSortedRowModel(), ...(paginate ? { getPaginationRowModel: getPaginationRowModel() } : {}) }),
    autoResetPageIndex: !server,
  });

  const total = server ? (rowCount ?? data.length) : data.length;
  // Deleting the final row on a page must return to the last available page.
  useEffect(() => {
    if (!paginate || status !== "ready") return;
    const last = Math.max(0, Math.ceil(total / pagination.pageSize) - 1);
    if (pagination.pageIndex > last) table.setPageIndex(last);
  }, [total, pagination.pageIndex, pagination.pageSize, paginate, status, table]);
  const selected = table.getSelectedRowModel().rows;
  const headerGroups = table.getHeaderGroups();
  const colCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;
  const showState = status !== "ready" && status !== "loading" ? status : rows.length === 0 && status === "ready" ? "empty" : null;

  return (
    <div data-density={density} className={cn("flex flex-col gap-3", className)}>
      {columnChooser ? <div className="flex justify-end"><ColumnChooser columns={table.getAllLeafColumns().map((column,index) => ({ id: column.id, label: typeof column.columnDef.header === "string" ? column.columnDef.header : column.id, visible: column.getIsVisible(), required: !column.getCanHide() || index === (selectable ? 1 : 0) }))} onChange={(id,visible) => table.getColumn(id)?.toggleVisibility(visible)} /></div> : null}
      {selectable && selected.length > 0 ? (
        <div role="region" aria-label={t("selectedCount", { count: selected.length })} className="flex flex-wrap items-center gap-3 rounded-field bg-brand-subtle px-3 py-2">
          <span className="text-body-sm font-semibold text-fg-brand">{t("selectedCount", { count: selected.length })}</span>
          <div className="flex flex-wrap items-center gap-2">{bulkActions?.(selected)}</div>
          <button
            type="button"
            onClick={() => table.resetRowSelection()}
            className="ms-auto inline-flex items-center gap-1 rounded-pill px-2 py-1 text-body-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
          >
            <X aria-hidden="true" className="size-3.5" />
            {t("clearSelection")}
          </button>
        </div>
      ) : null}

      {/* relative: absolutely placed content (a sr-only header label) is clipped here instead of widening the page in RTL. */}
      <div
        ref={scroller}
        {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": label } : {})}
        className="relative overflow-x-auto rounded-card border border-line bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <table aria-label={label} aria-busy={status === "loading" || undefined} style={resizable ? { width: table.getTotalSize(), minWidth: "100%", tableLayout: "fixed" } : undefined} className={cn("w-full border-collapse", density === "compact" ? "text-body-sm" : "text-body")}>
          <thead className={cn("bg-sunken", stickyHeader && "sticky top-0 z-10")}>
            {headerGroups.map((group) => (
              <tr key={group.id} className="border-b border-line">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const sortable = header.column.getCanSort();
                  const dir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      style={resizable ? { width: header.column.getSize() } : meta?.width ? { width: meta.width } : undefined}
                      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : sortable ? "none" : undefined}
                      className={cn("relative h-10 px-4 text-start align-middle text-caption font-semibold whitespace-nowrap text-fg-muted", meta?.numeric && "text-end", meta?.truncate && "min-w-48")}
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:text-fg focus-visible:outline-2 focus-visible:outline-focus",
                            dir && "text-fg",
                            meta?.numeric && "flex-row-reverse",
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {dir === "asc" ? (
                            <CaretUp aria-hidden="true" weight="bold" className="size-3" />
                          ) : dir === "desc" ? (
                            <CaretDown aria-hidden="true" weight="bold" className="size-3" />
                          ) : (
                            <CaretUpDown aria-hidden="true" className="size-3 opacity-60" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                      {resizable && header.column.getCanResize() ? <span role="separator" aria-orientation="vertical" aria-label={`${suiteText(locale, "resizeColumn")} ${typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : header.column.id}`} aria-valuemin={header.column.columnDef.minSize ?? 20} aria-valuemax={header.column.columnDef.maxSize ?? 2000} aria-valuenow={header.column.getSize()} tabIndex={0} className="absolute end-0 inset-y-1 w-2 cursor-col-resize rounded hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-focus" onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} onKeyDown={event => { if (!["ArrowLeft","ArrowRight"].includes(event.key)) return; event.preventDefault(); const increase = (event.key === "ArrowRight") !== (readingDirection === "rtl"); const next = Math.max(header.column.columnDef.minSize ?? 20, Math.min(header.column.columnDef.maxSize ?? 2000, header.column.getSize() + (increase ? 10 : -10))); table.setColumnSizing(previous => ({ ...previous, [header.column.id]: next })); }} /> : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {status === "loading" && rows.length === 0
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="[&>td]:border-b [&>td]:border-line [&:last-child>td]:border-0">
                    {Array.from({ length: colCount }, (_, j) => (
                      <td key={j} className="h-(--ot-row-height) px-4">
                        <Skeleton className={cn("h-3", j === 0 && selectable ? "size-4" : j % 3 === 0 ? "w-3/5" : "w-2/5")} />
                      </td>
                    ))}
                  </tr>
                ))
              : showState
                ? (
                    <tr>
                      <td colSpan={colCount}>
                        {showState === "error" ? (
                          <ErrorState size="compact" onRetry={onRetry} {...error} />
                        ) : showState === "forbidden" ? (
                          <NoPermissionState size="compact" {...forbidden} />
                        ) : (
                          <EmptyState size="compact" {...empty} />
                        )}
                      </td>
                    </tr>
                  )
                : rows.map((row) => (
                    <tr
                      key={row.id}
                      aria-selected={selectable ? row.getIsSelected() : undefined}
                      className="transition-colors hover:bg-hover aria-selected:bg-brand-subtle [&>td]:border-b [&>td]:border-line [&:last-child>td]:border-0"
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta;
                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              "h-(--ot-row-height) px-4 align-middle text-fg",
                              meta?.wrap ? "py-2" : "whitespace-nowrap",
                              meta?.numeric && "text-end tabular-nums",
                              meta?.truncate && "w-full max-w-0 min-w-48 truncate",
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>

      {paginate && total > 0 && status !== "error" && status !== "forbidden" ? (
        <Pagination
          page={pagination.pageIndex + 1}
          pageSize={pagination.pageSize}
          total={total}
          pageSizes={pageSizes}
          onPageChange={(p) => table.setPageIndex(p - 1)}
          onPageSizeChange={(size) => table.setPagination({ pageIndex: 0, pageSize: size })}
        />
      ) : null}
    </div>
  );
}

export type { ColumnDef, SortingState, PaginationState, RowSelectionState, Row } from "@tanstack/react-table";
