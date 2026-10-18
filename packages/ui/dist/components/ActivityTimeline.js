"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Avatar } from "./Display.js";
import { useFormatter, useOrgtik } from "../provider/OrgtikProvider.js";
export function ActivityTimeline({ items, label }) {
    const f = useFormatter(), { Link } = useOrgtik();
    return _jsx("ol", { "aria-label": label, className: "flex flex-col", children: items.map((item, index) => _jsxs("li", { className: "relative flex gap-3 pb-5 last:pb-0", children: [index < items.length - 1 ? _jsx("span", { "aria-hidden": "true", className: "absolute start-4 top-8 bottom-0 w-px bg-line" }) : null, _jsx(Avatar, { name: item.actor || item.title, size: "sm", decorative: true }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-body-sm font-semibold text-fg", children: item.href ? _jsx(Link, { href: item.href, className: "hover:underline", children: item.title }) : item.title }), item.description ? _jsx("p", { dir: "auto", className: "mt-0.5 text-body-sm text-fg-muted", children: item.description }) : null, _jsx("time", { dateTime: item.at, className: "text-caption text-fg-subtle", children: f.date(item.at, { dateStyle: "medium", timeStyle: "short" }) })] })] }, item.id)) });
}
//# sourceMappingURL=ActivityTimeline.js.map