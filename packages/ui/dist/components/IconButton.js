"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/cn.js";
const iconButton = cva([
    "inline-grid shrink-0 place-items-center rounded-field text-fg",
    "transition-[color,background-color,transform] duration-(--ot-duration-fast) ease-ot-out active:scale-95 motion-reduce:transform-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:pointer-events-none disabled:opacity-50",
], {
    variants: {
        variant: {
            ghost: "hover:bg-hover active:bg-pressed",
            secondary: "border border-line-control hover:bg-hover active:bg-pressed",
            primary: "bg-action-primary text-on-action-primary hover:bg-action-primary-hover",
        },
        size: { xs: "size-control-xs text-body-sm", sm: "size-control-sm text-body", md: "size-control-md text-body-lg", lg: "size-control-lg text-title" },
    },
    defaultVariants: { variant: "ghost", size: "md" },
});
export const IconButton = forwardRef(function IconButton({ label, icon, className, variant, size, type = "button", title, ...props }, ref) {
    return (_jsx("button", { ref: ref, type: type, "aria-label": label, title: title ?? label, className: cn(iconButton({ variant, size }), className), ...props, children: _jsx("span", { "aria-hidden": "true", className: "grid place-items-center", children: icon }) }));
});
//# sourceMappingURL=IconButton.js.map