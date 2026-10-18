"use client";
import { forwardRef, type ReactNode } from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "../lib/cn.js";

export type SwitchProps = Omit<BaseSwitch.Root.Props, "className" | "render" | "children"> & {
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
};

/**
 * An on/off setting that applies at once. For a choice saved with a form's Save button, use a
 * Checkbox instead. The thumb travels toward the reading end, so it mirrors in RTL.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch({ label, description, className, ...props }, ref) {
  const control = (
    <BaseSwitch.Root
      ref={ref}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill bg-line-control p-0.5",
        "transition-colors duration-(--ot-duration-base) ease-ot-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "data-[checked]:bg-action-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        label ? null : className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          "block size-5 rounded-pill bg-on-action-primary shadow-raised",
          "transition-transform duration-(--ot-duration-base) ease-ot-out",
          "data-[checked]:translate-x-4 rtl:data-[checked]:-translate-x-4",
        )}
      />
    </BaseSwitch.Root>
  );
  if (!label) return control;
  return (
    <label className={cn("inline-flex items-start gap-3 text-body text-fg has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-60", className)}>
      {control}
      <span className="flex flex-col gap-0.5 pt-px">
        <span>{label}</span>
        {description ? <span className="text-caption text-fg-muted">{description}</span> : null}
      </span>
    </label>
  );
});
