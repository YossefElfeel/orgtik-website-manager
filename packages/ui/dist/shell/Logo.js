import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from "react";
import { LOGO } from "../brand/logo-data.js";
import { cn } from "../lib/cn.js";
/** The OrgTik logo, from the website's files. It never mirrors in RTL. Server-safe. */
export function Logo({ variant = "mark", tone = "current", label = "OrgTik", className }) {
    const id = useId();
    const art = LOGO[variant];
    const gradient = tone === "brand" && variant === "mark";
    const g = LOGO.gradient;
    return (_jsxs("svg", { viewBox: art.viewBox, role: label ? "img" : undefined, "aria-label": label || undefined, "aria-hidden": label ? undefined : true, className: cn(variant === "mark" ? "h-8 w-auto" : "h-6 w-auto", className), fill: gradient ? `url(#${id})` : "currentColor", children: [gradient ? (_jsx("defs", { children: _jsx("linearGradient", { id: id, gradientUnits: "userSpaceOnUse", x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, children: g.stops.map((s) => (_jsx("stop", { offset: s.offset, stopColor: s.color }, s.offset))) }) })) : null, art.paths.map((d, i) => (_jsx("path", { d: d }, i)))] }));
}
//# sourceMappingURL=Logo.js.map