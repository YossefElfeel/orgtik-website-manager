"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Children, cloneElement, Fragment, isValidElement, useEffect, useState, } from "react";
import { Pagination } from "../components/Navigation.js";
import { cn } from "../lib/cn.js";
function rowsOf(children) {
    return Children.toArray(children).flatMap((child) => isValidElement(child) && child.type === Fragment
        ? rowsOf(child.props.children)
        : [child]);
}
/** Keeps specialized invoice, pricing, and import tables while applying suite table defaults. */
export function PaginatedTable({ children, resetKey, }) {
    const [page, setPage] = useState(1);
    const parts = Children.toArray(children.props.children);
    const bodies = parts.filter((part) => isValidElement(part) && part.type === "tbody");
    const total = bodies.reduce((count, body) => count + rowsOf(body.props.children).length, 0);
    const last = Math.max(1, Math.ceil(total / 10));
    const current = Math.min(page, last);
    useEffect(() => setPage(1), [resetKey]);
    useEffect(() => {
        if (page > last)
            setPage(last);
    }, [last, page]);
    let offset = 0;
    const shown = parts.map((part) => {
        if (!isValidElement(part))
            return part;
        if (part.type === "thead")
            return cloneElement(part, {
                className: cn(part.props.className, "bg-sunken"),
            });
        if (part.type !== "tbody")
            return part;
        const rows = rowsOf(part.props.children);
        const start = (current - 1) * 10 - offset;
        offset += rows.length;
        return cloneElement(part, {}, rows.slice(Math.max(0, start), Math.max(0, start + 10)));
    });
    return (_jsxs("div", { className: "flex min-w-0 flex-col gap-3", children: [_jsx("div", { className: "max-w-full overflow-x-auto", children: cloneElement(children, {}, shown) }), _jsx(Pagination, { page: current, pageSize: 10, total: total, onPageChange: setPage, onPageSizeChange: () => setPage(1), pageSizes: [10] })] }));
}
//# sourceMappingURL=PaginatedTable.js.map