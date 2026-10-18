"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { PageHeader } from "../components/Navigation.js";
import { cn } from "../lib/cn.js";
export function SettingsLayout({ title, description, sections, active, actions, children }) {
    const { Link } = useOrgtik();
    return _jsxs("div", { className: "mx-auto flex w-full max-w-(--ot-layout-default) flex-col gap-6", children: [_jsx(PageHeader, { title: title, description: description, actions: actions }), _jsxs("div", { className: "grid min-w-0 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]", children: [_jsx("nav", { "aria-label": title, className: "flex flex-wrap gap-1 self-start lg:flex-col", children: sections.map(section => _jsxs(Link, { href: section.href, "aria-current": section.id === active ? "page" : undefined, className: cn("flex min-h-9 items-center gap-2 rounded-field px-3 py-2 text-body-sm text-fg-muted hover:bg-hover", section.id === active && "bg-brand-subtle font-semibold text-fg-brand"), children: [section.icon, _jsx("span", { children: section.label })] }, section.id)) }), _jsx("div", { className: "min-w-0", children: children })] })] });
}
//# sourceMappingURL=SettingsLayout.js.map