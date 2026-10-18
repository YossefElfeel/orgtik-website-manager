"use client";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn.js";

const iconButton = cva(
  [
    "inline-grid shrink-0 place-items-center rounded-field text-fg",
    "transition-[color,background-color,transform] duration-(--ot-duration-fast) ease-ot-out active:scale-95 motion-reduce:transform-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        ghost: "hover:bg-hover active:bg-pressed",
        secondary: "border border-line-control hover:bg-hover active:bg-pressed",
        primary: "bg-action-primary text-on-action-primary hover:bg-action-primary-hover",
      },
      size: { xs: "size-control-xs text-body-sm", sm: "size-control-sm text-body", md: "size-control-md text-body-lg", lg: "size-control-lg text-title" },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> &
  VariantProps<typeof iconButton> & {
    /**
     * What the button does, for people who can't see the icon. Required: the Files audit found
     * 91 icon-only buttons with no name.
     */
    label: string;
    icon: ReactNode;
  };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, className, variant, size, type = "button", title, ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} aria-label={label} title={title ?? label} className={cn(iconButton({ variant, size }), className)} {...props}>
      <span aria-hidden="true" className="grid place-items-center">
        {icon}
      </span>
    </button>
  );
});
