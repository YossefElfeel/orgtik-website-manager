"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function BulkActionBar({ label, selection, children, align = "center" }) {
    return _jsxs("div", { role: "region", "aria-label": label, className: `flex flex-wrap gap-3 rounded-panel border border-line bg-brand-subtle p-3 ${align === "end" ? "items-end" : "items-center"}`, children: [_jsx("p", { className: "me-auto text-body font-semibold", "aria-live": "polite", children: selection }), children] });
}
//# sourceMappingURL=BulkActionBar.js.map