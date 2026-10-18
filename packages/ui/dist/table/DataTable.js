"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// DataTable, in its own entry (`@orgtik/ui/table`) so apps without TanStack Table never load it.
// It lifts HR's table behaviour (server paging, sort, selection, skeleton rows), not its styles.
import { useEffect, useMemo, useRef, useState } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, } from "@tanstack/react-table";
import { CaretDown, CaretUp, CaretUpDown, X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";
import { Checkbox } from "../components/Checkbox.js";
import { Skeleton } from "../components/Display.js";
import { Pagination } from "../components/Navigation.js";
import { EmptyState, ErrorState, NoPermissionState } from "../components/States.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { ColumnChooser } from "../components/ColumnChooser.js";
import { suiteText } from "../suite/strings.js";
export function DataTable({ columns, data, getRowId, label, status = "ready", empty, error, forbidden, onRetry, mode = "client", rowCount, sorting: sortingProp, onSortingChange, pagination: paginationProp, onPaginationChange, pageSizes = [10], paginate = true, selectable = false, rowSelection: selectionProp, onRowSelectionChange, bulkActions, className, density = "comfortable", stickyHeader = true, columnChooser = false, columnVisibility: visibilityProp, onColumnVisibilityChange, resizable = false, columnSizing: sizingProp, onColumnSizingChange, rowActions, }) {
    const t = useStrings();
    const { locale, dir: readingDirection } = useOrgtik();
    // A table wider than its box scrolls sideways; then the box is a labelled region you can focus
    // and scroll with the keyboard (WCAG 2.1.1). A table that fits adds no extra tab stop.
    const scroller = useRef(null);
    const [scrolls, setScrolls] = useState(false);
    useEffect(() => {
        const el = scroller.current;
        if (!el)
            return;
        const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        if (el.firstElementChild)
            ro.observe(el.firstElementChild);
        return () => ro.disconnect();
    }, []);
    const [innerSorting, setInnerSorting] = useState([]);
    const [innerPagination, setInnerPagination] = useState({ pageIndex: 0, pageSize: pageSizes[0] ?? 10 });
    const [innerSelection, setInnerSelection] = useState({});
    const [innerVisibility, setInnerVisibility] = useState({});
    const [innerSizing, setInnerSizing] = useState({});
    const sorting = sortingProp ?? innerSorting;
    const pagination = paginationProp ?? innerPagination;
    const rowSelection = selectionProp ?? innerSelection;
    const server = mode === "server";
    const allColumns = useMemo(() => {
        const fields = rowActions ? [...columns, { id: "__actions", header: suiteText(locale, "actions"), enableSorting: false, enableHiding: false, enableResizing: false, size: 64, meta: { width: "1%" }, cell: ({ row }) => rowActions(row.original) }] : columns;
        if (!selectable)
            return fields;
        const select = {
            id: "__select",
            enableHiding: false,
            enableResizing: false,
            size: 44,
            enableSorting: false,
            meta: { width: "1%" },
            header: ({ table }) => (_jsx(Checkbox, { "aria-label": t("selectAll"), checked: table.getIsAllPageRowsSelected(), indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(), onCheckedChange: (v) => table.toggleAllPageRowsSelected(Boolean(v)) })),
            cell: ({ row }) => (_jsx(Checkbox, { "aria-label": t("selectRow"), checked: row.getIsSelected(), disabled: !row.getCanSelect(), onCheckedChange: (v) => row.toggleSelected(Boolean(v)) })),
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
        if (!paginate || status !== "ready")
            return;
        const last = Math.max(0, Math.ceil(total / pagination.pageSize) - 1);
        if (pagination.pageIndex > last)
            table.setPageIndex(last);
    }, [total, pagination.pageIndex, pagination.pageSize, paginate, status, table]);
    const selected = table.getSelectedRowModel().rows;
    const headerGroups = table.getHeaderGroups();
    const colCount = table.getVisibleLeafColumns().length;
    const rows = table.getRowModel().rows;
    const showState = status !== "ready" && status !== "loading" ? status : rows.length === 0 && status === "ready" ? "empty" : null;
    return (_jsxs("div", { "data-density": density, className: cn("flex flex-col gap-3", className), children: [columnChooser ? _jsx("div", { className: "flex justify-end", children: _jsx(ColumnChooser, { columns: table.getAllLeafColumns().map((column, index) => ({ id: column.id, label: typeof column.columnDef.header === "string" ? column.columnDef.header : column.id, visible: column.getIsVisible(), required: !column.getCanHide() || index === (selectable ? 1 : 0) })), onChange: (id, visible) => table.getColumn(id)?.toggleVisibility(visible) }) }) : null, selectable && selected.length > 0 ? (_jsxs("div", { role: "region", "aria-label": t("selectedCount", { count: selected.length }), className: "flex flex-wrap items-center gap-3 rounded-field bg-brand-subtle px-3 py-2", children: [_jsx("span", { className: "text-body-sm font-semibold text-fg-brand", children: t("selectedCount", { count: selected.length }) }), _jsx("div", { className: "flex flex-wrap items-center gap-2", children: bulkActions?.(selected) }), _jsxs("button", { type: "button", onClick: () => table.resetRowSelection(), className: "ms-auto inline-flex items-center gap-1 rounded-pill px-2 py-1 text-body-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus", children: [_jsx(X, { "aria-hidden": "true", className: "size-3.5" }), t("clearSelection")] })] })) : null, _jsx("div", { ref: scroller, ...(scrolls ? { tabIndex: 0, role: "region", "aria-label": label } : {}), className: "relative overflow-x-auto rounded-card border border-line bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", children: _jsxs("table", { "aria-label": label, "aria-busy": status === "loading" || undefined, style: resizable ? { width: table.getTotalSize(), minWidth: "100%", tableLayout: "fixed" } : undefined, className: cn("w-full border-collapse", density === "compact" ? "text-body-sm" : "text-body"), children: [_jsx("thead", { className: cn("bg-sunken", stickyHeader && "sticky top-0 z-10"), children: headerGroups.map((group) => (_jsx("tr", { className: "border-b border-line", children: group.headers.map((header) => {
                                    const meta = header.column.columnDef.meta;
                                    const sortable = header.column.getCanSort();
                                    const dir = header.column.getIsSorted();
                                    return (_jsxs("th", { scope: "col", style: resizable ? { width: header.column.getSize() } : meta?.width ? { width: meta.width } : undefined, "aria-sort": dir === "asc" ? "ascending" : dir === "desc" ? "descending" : sortable ? "none" : undefined, className: cn("relative h-10 px-4 text-start align-middle text-caption font-semibold whitespace-nowrap text-fg-muted", meta?.numeric && "text-end", meta?.truncate && "min-w-48"), children: [header.isPlaceholder ? null : sortable ? (_jsxs("button", { type: "button", onClick: header.column.getToggleSortingHandler(), className: cn("-mx-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:text-fg focus-visible:outline-2 focus-visible:outline-focus", dir && "text-fg", meta?.numeric && "flex-row-reverse"), children: [flexRender(header.column.columnDef.header, header.getContext()), dir === "asc" ? (_jsx(CaretUp, { "aria-hidden": "true", weight: "bold", className: "size-3" })) : dir === "desc" ? (_jsx(CaretDown, { "aria-hidden": "true", weight: "bold", className: "size-3" })) : (_jsx(CaretUpDown, { "aria-hidden": "true", className: "size-3 opacity-60" }))] })) : (flexRender(header.column.columnDef.header, header.getContext())), resizable && header.column.getCanResize() ? _jsx("span", { role: "separator", "aria-orientation": "vertical", "aria-label": `${suiteText(locale, "resizeColumn")} ${typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : header.column.id}`, "aria-valuemin": header.column.columnDef.minSize ?? 20, "aria-valuemax": header.column.columnDef.maxSize ?? 2000, "aria-valuenow": header.column.getSize(), tabIndex: 0, className: "absolute end-0 inset-y-1 w-2 cursor-col-resize rounded hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-focus", onMouseDown: header.getResizeHandler(), onTouchStart: header.getResizeHandler(), onKeyDown: event => { if (!["ArrowLeft", "ArrowRight"].includes(event.key))
                                                    return; event.preventDefault(); const increase = (event.key === "ArrowRight") !== (readingDirection === "rtl"); const next = Math.max(header.column.columnDef.minSize ?? 20, Math.min(header.column.columnDef.maxSize ?? 2000, header.column.getSize() + (increase ? 10 : -10))); table.setColumnSizing(previous => ({ ...previous, [header.column.id]: next })); } }) : null] }, header.id));
                                }) }, group.id))) }), _jsx("tbody", { children: status === "loading" && rows.length === 0
                                ? Array.from({ length: 6 }, (_, i) => (_jsx("tr", { className: "[&>td]:border-b [&>td]:border-line [&:last-child>td]:border-0", children: Array.from({ length: colCount }, (_, j) => (_jsx("td", { className: "h-(--ot-row-height) px-4", children: _jsx(Skeleton, { className: cn("h-3", j === 0 && selectable ? "size-4" : j % 3 === 0 ? "w-3/5" : "w-2/5") }) }, j))) }, i)))
                                : showState
                                    ? (_jsx("tr", { children: _jsx("td", { colSpan: colCount, children: showState === "error" ? (_jsx(ErrorState, { size: "compact", onRetry: onRetry, ...error })) : showState === "forbidden" ? (_jsx(NoPermissionState, { size: "compact", ...forbidden })) : (_jsx(EmptyState, { size: "compact", ...empty })) }) }))
                                    : rows.map((row) => (_jsx("tr", { "aria-selected": selectable ? row.getIsSelected() : undefined, className: "transition-colors hover:bg-hover aria-selected:bg-brand-subtle [&>td]:border-b [&>td]:border-line [&:last-child>td]:border-0", children: row.getVisibleCells().map((cell) => {
                                            const meta = cell.column.columnDef.meta;
                                            return (_jsx("td", { className: cn("h-(--ot-row-height) px-4 align-middle text-fg", meta?.wrap ? "py-2" : "whitespace-nowrap", meta?.numeric && "text-end tabular-nums", meta?.truncate && "w-full max-w-0 min-w-48 truncate"), children: flexRender(cell.column.columnDef.cell, cell.getContext()) }, cell.id));
                                        }) }, row.id))) })] }) }), paginate && total > 0 && status !== "error" && status !== "forbidden" ? (_jsx(Pagination, { page: pagination.pageIndex + 1, pageSize: pagination.pageSize, total: total, pageSizes: pageSizes, onPageChange: (p) => table.setPageIndex(p - 1), onPageSizeChange: (size) => table.setPagination({ pageIndex: 0, pageSize: size }) })) : null] }));
}
//# sourceMappingURL=DataTable.js.map