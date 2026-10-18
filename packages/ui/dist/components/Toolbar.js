"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MagnifyingGlass, ListBullets, Rows } from "@phosphor-icons/react";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { Input } from "./Input.js";
import { IconButton } from "./IconButton.js";
import { cn } from "../lib/cn.js";
const copy = {
    en: { comfortable: "Comfortable density", compact: "Compact density" },
    ar: { comfortable: "كثافة مريحة", compact: "كثافة مدمجة" },
    de: { comfortable: "Komfortable Dichte", compact: "Kompakte Dichte" },
    fr: { comfortable: "Densité confortable", compact: "Densité compacte" },
    it: { comfortable: "Densità confortevole", compact: "Densità compatta" },
};
export function Toolbar({ label, search, filters, actions, density = "comfortable", onDensityChange, children, className }) {
    const { locale } = useOrgtik();
    return (_jsxs("section", { "aria-label": label, className: cn("flex flex-wrap items-center gap-2 rounded-field border border-line bg-raised p-2 shadow-xs", className), children: [search ? _jsx("div", { className: "min-w-40 flex-1 sm:max-w-80", children: _jsx(Input, { type: "search", value: search.value, onChange: event => search.onChange(event.target.value), "aria-label": search.label, placeholder: search.placeholder ?? search.label, startIcon: _jsx(MagnifyingGlass, {}) }) }) : null, filters, children, _jsxs("div", { className: "ms-auto flex flex-wrap items-center gap-2", children: [actions, onDensityChange ? _jsxs("div", { className: "flex items-center gap-1 border-s border-line ps-2", children: [_jsx(IconButton, { size: "sm", label: copy[locale].comfortable, icon: _jsx(Rows, {}), "aria-pressed": density === "comfortable", onClick: () => onDensityChange("comfortable"), className: density === "comfortable" ? "bg-brand-subtle text-fg-brand" : undefined }), _jsx(IconButton, { size: "sm", label: copy[locale].compact, icon: _jsx(ListBullets, {}), "aria-pressed": density === "compact", onClick: () => onDensityChange("compact"), className: density === "compact" ? "bg-brand-subtle text-fg-brand" : undefined })] }) : null] })] }));
}
//# sourceMappingURL=Toolbar.js.map