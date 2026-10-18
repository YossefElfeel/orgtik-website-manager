"use client";
import { forwardRef, type ReactNode } from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check, Minus } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";

export type CheckboxProps = Omit<BaseCheckbox.Root.Props, "className" | "render" | "children"> & {
  /** The visible label. Leave it out only when the row or column around it names the checkbox, and pass aria-label. */
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
};

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox({ label, description, className, ...props }, ref) {
  const box = (
    <BaseCheckbox.Root
      ref={ref}
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-md border border-line-control bg-raised text-on-action-primary",
        "transition-colors duration-(--ot-duration-fast) ease-ot-out",
        "hover:border-fg-subtle",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "data-[checked]:border-action-primary data-[checked]:bg-action-primary",
        "data-[indeterminate]:border-action-primary data-[indeterminate]:bg-action-primary",
        "data-[invalid]:border-danger data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[readonly]:opacity-70",
        label ? "mt-[0.2em]" : null,
        label ? null : className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator className="grid place-items-center data-[unchecked]:hidden">
        {props.indeterminate ? <Minus weight="bold" className="size-3" /> : <Check weight="bold" className="size-3" />}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
  if (!label) return box;
  return (
    <label className={cn("inline-flex items-start gap-2.5 text-body text-fg has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-60", className)}>
      {box}
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {description ? <span className="text-caption text-fg-muted">{description}</span> : null}
      </span>
    </label>
  );
});
