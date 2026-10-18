"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import { cva } from "class-variance-authority";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";
// Avatar -------------------------------------------------------------------------------------
const avatar = cva("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-pill bg-brand-subtle font-body font-semibold text-fg-brand select-none", {
    variants: { size: { xs: "size-6 text-micro", sm: "size-8 text-caption", md: "size-10 text-body-sm", lg: "size-14 text-title-sm" } },
    defaultVariants: { size: "md" },
});
/**
 * Up to two initials from a name. Arabic letters would join into one shape ("هس"), so they are
 * kept apart with a zero-width non-joiner.
 */
export function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] ? Array.from(parts[0])[0] : "";
    const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : "";
    const joiner = /[؀-ۿ]/.test(first + last) ? "‌" : "";
    return (first + (last ? joiner + last : "")).toLocaleUpperCase();
}
export function Avatar({ name, src, size, className, decorative = false }) {
    return (_jsxs(BaseAvatar.Root, { className: cn(avatar({ size }), className), "aria-hidden": decorative || undefined, title: decorative ? undefined : name, children: [src ? _jsx(BaseAvatar.Image, { src: src, alt: decorative ? "" : name, className: "size-full object-cover" }) : null, _jsx(BaseAvatar.Fallback, { "aria-label": decorative ? undefined : name, role: decorative ? undefined : "img", children: size === "xs" ? Array.from(initials(name))[0] : initials(name) })] }));
}
// Card ---------------------------------------------------------------------------------------
const card = cva("rounded-card border border-line bg-raised text-fg", {
    variants: {
        padding: { none: "", sm: "p-4", md: "p-5", lg: "p-6" },
        /** raised lifts a card that floats over other content (e.g. a pinned summary); most cards are flat. */
        elevation: { flat: "", raised: "shadow-raised" },
    },
    defaultVariants: { padding: "md", elevation: "flat" },
});
/** A container for one object or one summary. Not a wrapper for every block on a page. */
export function Card({ className, padding, elevation, ...props }) {
    return _jsx("div", { className: cn(card({ padding, elevation }), className), ...props });
}
export function CardHeader({ title, description, actions, className }) {
    return (_jsxs("div", { className: cn("flex items-start justify-between gap-4", className), children: [_jsxs("div", { className: "flex min-w-0 flex-col gap-1", children: [_jsx("h3", { className: "font-display text-title-sm text-fg", children: title }), description ? _jsx("p", { className: "text-body-sm text-fg-muted", children: description }) : null] }), actions ? _jsx("div", { className: "flex shrink-0 items-center gap-2", children: actions }) : null] }));
}
// Skeleton and Spinner -----------------------------------------------------------------------
/** A placeholder with the shape of the content that is loading. The region should carry aria-busy. */
export function Skeleton({ className, ...props }) {
    return _jsx("div", { "aria-hidden": "true", className: cn("ot-skeleton rounded-field bg-sunken", className), ...props });
}
const spinner = cva("animate-spin motion-reduce:animate-[spin_1.5s_linear_infinite]", {
    variants: { size: { sm: "size-4", md: "size-5", lg: "size-8" } },
    defaultVariants: { size: "md" },
});
/**
 * A busy indicator. With `label` it announces itself (role="status"); without one it's
 * decorative, for use inside something that already says it's busy (a Button's `loading`).
 */
export function Spinner({ size, className, label }) {
    const t = useStrings();
    const text = label === true ? t("loading") : label;
    const svg = (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", className: cn(spinner({ size }), "text-fg-brand", className), children: [_jsx("circle", { cx: "12", cy: "12", r: "9", stroke: "currentColor", strokeOpacity: "0.2", strokeWidth: "3" }), _jsx("path", { d: "M21 12a9 9 0 0 0-9-9", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round" })] }));
    if (!text)
        return svg;
    return (_jsxs("span", { role: "status", className: "inline-flex items-center gap-2 text-body-sm text-fg-muted", children: [svg, _jsx("span", { children: text })] }));
}
//# sourceMappingURL=Display.js.map