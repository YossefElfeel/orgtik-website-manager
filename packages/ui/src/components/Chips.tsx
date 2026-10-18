"use client";
import type { ReactNode } from "react";
import { Check, X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";

/** A label on an object (a file's tags). With `onRemove` it gets a named remove button. */
export function Tag({ children, onRemove, className }: { children: ReactNode; onRemove?: () => void; className?: string }) {
  const t = useStrings();
  const text = typeof children === "string" ? children : "";
  return (
    <span className={cn("inline-flex h-7 max-w-full items-center gap-1 rounded-pill border border-line bg-raised ps-2.5 text-body-sm text-fg", onRemove ? "pe-1" : "pe-2.5", className)}>
      <span dir="auto" className="truncate">
        {children}
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("removeItem", { label: text })}
          className="grid size-5 shrink-0 place-items-center rounded-pill text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

export type FilterChip<V extends string = string> = { value: V; label: ReactNode; count?: number };

/**
 * Quick filters that combine (status: Open, Overdue). Each chip is a toggle that reports
 * aria-pressed; "Clear" appears once any is on.
 */
export function FilterChips<V extends string = string>({
  chips,
  value,
  onValueChange,
  label,
  className,
}: {
  chips: FilterChip<V>[];
  value: V[];
  onValueChange: (value: V[]) => void;
  /** What the chips filter, e.g. "Status". */
  label: string;
  className?: string;
}) {
  const t = useStrings();
  const on = new Set(value);
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((c) => {
        const pressed = on.has(c.value);
        return (
          <button
            key={c.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onValueChange(pressed ? value.filter((v) => v !== c.value) : [...value, c.value])}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-body-sm font-semibold transition-colors duration-(--ot-duration-fast)",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              pressed ? "border-action-primary bg-brand-subtle text-fg-brand" : "border-line-control text-fg-muted hover:bg-hover hover:text-fg",
            )}
          >
            {pressed ? <Check aria-hidden="true" weight="bold" className="size-3.5" /> : null}
            {c.label}
            {c.count !== undefined ? <span className="text-caption font-normal tabular-nums opacity-80">{c.count}</span> : null}
          </button>
        );
      })}
      {value.length ? (
        <button type="button" onClick={() => onValueChange([])} className="h-8 rounded-pill px-2 text-body-sm text-fg-muted hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus">
          {t("clear")}
        </button>
      ) : null}
    </div>
  );
}
