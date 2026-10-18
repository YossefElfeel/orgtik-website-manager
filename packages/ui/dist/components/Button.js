"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/cn.js";
export const buttonVariants = cva([
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill font-body font-semibold whitespace-nowrap select-none",
    "transition-[color,background-color,box-shadow,transform] duration-(--ot-duration-fast) ease-ot-out active:scale-[0.98] motion-reduce:transform-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
], {
    variants: {
        variant: {
            primary: "bg-action-primary text-on-action-primary hover:bg-action-primary-hover active:brightness-90",
            secondary: "border border-line-control bg-transparent text-fg hover:bg-hover active:bg-pressed",
            ghost: "bg-transparent text-fg hover:bg-hover active:bg-pressed",
            danger: "bg-danger-solid text-on-danger-solid hover:bg-danger-solid-hover active:brightness-90",
            warning: "bg-warning-solid text-on-warning-solid hover:brightness-95 active:brightness-90",
            link: "h-auto bg-transparent px-0 text-fg-brand underline-offset-4 hover:underline",
            // The website's signature: a pill with an arrow chip at the end (the chip mirrors in RTL).
            brand: "bg-action-brand text-on-action-brand hover:bg-action-brand-hover active:brightness-90",
        },
        size: {
            xs: "h-control-xs px-2.5 text-caption",
            sm: "h-control-sm px-3 text-body-sm",
            md: "h-control-md px-4 text-body",
            lg: "h-control-lg px-5 text-body-lg",
        },
    },
    compoundVariants: [
        { variant: "brand", size: "sm", className: "ps-3 pe-1" },
        { variant: "brand", size: "md", className: "ps-4 pe-1.5" },
        { variant: "brand", size: "lg", className: "ps-5 pe-2" },
        { variant: "link", className: "h-auto px-0" },
    ],
    defaultVariants: { variant: "primary", size: "md" },
});
function Arrow() {
    // Phosphor's ArrowRight path, inline so the library needs no icon package for its own chip.
    return (_jsx("svg", { viewBox: "0 0 256 256", "aria-hidden": "true", className: "size-[1.1em] rtl:-scale-x-100", fill: "currentColor", children: _jsx("path", { d: "M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" }) }));
}
function Spinner() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", className: "size-[1.1em] animate-spin motion-reduce:animate-none", fill: "none", children: [_jsx("circle", { cx: "12", cy: "12", r: "9", stroke: "currentColor", strokeOpacity: "0.25", strokeWidth: "3" }), _jsx("path", { d: "M21 12a9 9 0 0 0-9-9", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round" })] }));
}
export const Button = forwardRef(function Button({ className, variant, size, shape, loading = false, startIcon, endIcon, disabled, children, type = "button", ...props }, ref) {
    const brand = variant === "brand";
    return (_jsxs("button", { ref: ref, type: type, className: cn(buttonVariants({ variant, size }), shape === "control" && "rounded-field", className), disabled: disabled || loading, "aria-busy": loading || undefined, ...props, children: [loading ? _jsx(Spinner, {}) : startIcon, _jsx("span", { children: children }), brand ? (_jsx("span", { className: "grid aspect-square h-[calc(100%-8px)] place-items-center rounded-pill bg-on-action-brand text-action-brand", children: _jsx(Arrow, {}) })) : (endIcon)] }));
});
//# sourceMappingURL=Button.js.map