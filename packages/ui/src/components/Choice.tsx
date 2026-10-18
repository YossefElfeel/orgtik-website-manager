"use client";
import type { ReactNode } from "react";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import { cn } from "../lib/cn.js";

// RadioGroup ---------------------------------------------------------------------------------

export type RadioOption<V extends string = string> = { value: V; label: ReactNode; description?: ReactNode; disabled?: boolean };

export type RadioGroupProps<V extends string = string> = {
  options: RadioOption<V>[];
  value?: V;
  defaultValue?: V;
  onValueChange?: (value: V) => void;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** Stack the options (default) or lay them in a row. */
  orientation?: "vertical" | "horizontal";
  /** The group's name for assistive tech when no Field label names it. */
  "aria-label"?: string;
  className?: string;
};

/**
 * One choice from a few (up to about five), all visible. Arrow keys move between options in the
 * reading direction. For many options use Select; for a view switch use SegmentedControl.
 */
export function RadioGroup<V extends string = string>({ options, onValueChange, orientation = "vertical", className, ...props }: RadioGroupProps<V>) {
  return (
    <BaseRadioGroup
      onValueChange={(v) => onValueChange?.(v as V)}
      className={cn("flex gap-3", orientation === "vertical" ? "flex-col" : "flex-row flex-wrap gap-x-6", className)}
      {...props}
    >
      {options.map((o) => (
        <label key={o.value} className="inline-flex items-start gap-2.5 text-body text-fg has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-60">
          <Radio.Root
            value={o.value}
            disabled={o.disabled}
            className={cn(
              "mt-[0.2em] grid size-[18px] shrink-0 place-items-center rounded-pill border border-line-control bg-raised",
              "transition-colors duration-(--ot-duration-fast) ease-ot-out hover:border-fg-subtle",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              "data-[checked]:border-action-primary data-[invalid]:border-danger",
            )}
          >
            <Radio.Indicator className="block size-2.5 rounded-pill bg-action-primary data-[unchecked]:hidden" />
          </Radio.Root>
          <span className="flex flex-col gap-0.5">
            <span>{o.label}</span>
            {o.description ? <span className="text-caption text-fg-muted">{o.description}</span> : null}
          </span>
        </label>
      ))}
    </BaseRadioGroup>
  );
}

// SegmentedControl ---------------------------------------------------------------------------

export type Segment<V extends string = string> = { value: V; label: ReactNode; icon?: ReactNode; disabled?: boolean };

export type SegmentedControlProps<V extends string = string> = {
  segments: Segment<V>[];
  value: V;
  onValueChange: (value: V) => void;
  /** What the control switches, e.g. "View". Required: the group needs a name. */
  label: string;
  size?: "sm" | "md";
  /** Icons only; each segment's label becomes its spoken name. */
  iconOnly?: boolean;
  className?: string;
};

/**
 * One of a few mutually exclusive modes, applied at once (list/grid, day/week/month). Each segment
 * reports aria-pressed, so the current one is announced (the Files audit found five switches
 * that didn't say which option was on).
 */
export function SegmentedControl<V extends string = string>({ segments, value, onValueChange, label, size = "md", iconOnly = false, className }: SegmentedControlProps<V>) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        // A segmented control always has one choice: pressing the current one keeps it.
        const picked = next.find((v) => v !== value) ?? value;
        if (picked !== value) onValueChange(picked as V);
      }}
      className={cn("inline-flex items-center gap-1 rounded-pill bg-sunken p-1", className)}
    >
      {segments.map((s) => (
        <Toggle
          key={s.value}
          value={s.value}
          disabled={s.disabled}
          aria-label={iconOnly && typeof s.label === "string" ? s.label : undefined}
          title={iconOnly && typeof s.label === "string" ? s.label : undefined}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-pill font-body font-semibold text-fg-muted select-none",
            "transition-colors duration-(--ot-duration-fast) ease-ot-out hover:text-fg",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
            "data-[pressed]:bg-raised data-[pressed]:text-fg data-[pressed]:shadow-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            "[&_svg]:size-4 [&_svg]:shrink-0",
            size === "sm" ? "h-7 text-body-sm" : "h-8 text-body",
            iconOnly ? (size === "sm" ? "w-7" : "w-8") : "px-3",
          )}
        >
          {s.icon ? <span aria-hidden="true" className="contents">{s.icon}</span> : null}
          {iconOnly ? null : s.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
