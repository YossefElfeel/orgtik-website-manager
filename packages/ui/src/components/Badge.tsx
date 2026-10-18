"use client";
import type { HTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { STATUS_MATRIX, type StatusEntity, type StatusState } from "../status/matrix.js";
import { STATUS_ICONS } from "../status/icons.js";

export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger";

export const badgeVariants = cva(
  "inline-flex max-w-full shrink-0 items-center gap-1 rounded-pill font-body font-semibold whitespace-nowrap [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-sunken text-fg-muted",
        brand: "bg-brand-subtle text-fg-brand",
        info: "bg-info-subtle text-info",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        danger: "bg-danger-subtle text-danger",
      },
      /** solid for the one thing on a screen that must be seen first (e.g. "Overdue"). */
      emphasis: { subtle: "", solid: "", outline: "border bg-transparent" },
      size: { sm: "h-5 px-2 text-micro", md: "h-6 px-2.5 text-caption" },
    },
    compoundVariants: [
      { emphasis: "solid", tone: "neutral", className: "bg-fg-muted text-raised" },
      { emphasis: "solid", tone: "brand", className: "bg-action-brand text-on-action-brand" },
      { emphasis: "solid", tone: "info", className: "bg-info-solid text-on-info-solid" },
      { emphasis: "solid", tone: "success", className: "bg-success-solid text-on-success-solid" },
      { emphasis: "solid", tone: "warning", className: "bg-warning-solid text-on-warning-solid" },
      { emphasis: "solid", tone: "danger", className: "bg-danger-solid text-on-danger-solid" },
      { emphasis: "outline", className: "border-current" },
    ],
    defaultVariants: { tone: "neutral", emphasis: "subtle", size: "md" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { icon?: ReactNode; dot?: boolean };

/** A short label. Colour is never the only signal: pair a tone with words, and an icon for status. */
export function Badge({ className, tone, emphasis, size, icon, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, emphasis, size }), className)} {...props}>
      {icon ? <span aria-hidden="true" className="contents">{icon}</span> : null}
      {dot ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-pill bg-current" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

type Entry = { tone: Tone; icon: string | null; label: Record<string, string>; customerLabel?: Record<string, string> };

export type StatusBadgeProps<E extends StatusEntity> = Omit<BadgeProps, "tone" | "icon" | "children"> & {
  entity: E;
  state: StatusState<E>;
  /**
   * Who is looking. Some states read differently to customers (D-027): a service request
   * "quoted" is "Quote to review" for the customer. Default: staff.
   */
  viewer?: "staff" | "customer";
  /** Extra words after the label, e.g. the days left: "Trial · 5 days". */
  detail?: ReactNode;
};

/**
 * A status's label as text, in the current language, for places a badge doesn't fit (tabs,
 * filters, a select's options). Same table as StatusBadge.
 */
export function useStatusLabel() {
  const { locale } = useOrgtik();
  return <E extends StatusEntity>(entity: E, state: StatusState<E>, viewer: "staff" | "customer" = "staff") => {
    const entry = (STATUS_MATRIX[entity] as Record<string, Entry>)[state as string];
    if (!entry) return String(state);
    const labels = viewer === "customer" && entry.customerLabel ? entry.customerLabel : entry.label;
    return labels[locale] ?? labels.en;
  };
}

/**
 * A status, from the unified status matrix: the label in the current language, the tone and the
 * icon all come from one table, so "Active" looks and reads the same in every app.
 */
export function StatusBadge<E extends StatusEntity>({ entity, state, viewer = "staff", detail, ...props }: StatusBadgeProps<E>) {
  const { locale } = useOrgtik();
  const entry = (STATUS_MATRIX[entity] as Record<string, Entry>)[state];
  if (!entry) {
    // An unknown state shows its key rather than disappearing, so the gap is visible in QA.
    return <Badge tone="neutral" {...props}>{String(state)}</Badge>;
  }
  const labels = viewer === "customer" && entry.customerLabel ? entry.customerLabel : entry.label;
  const Icon = entry.icon ? STATUS_ICONS[entry.icon] : null;
  return (
    <Badge tone={entry.tone} icon={Icon ? <Icon weight="bold" /> : null} data-status={`${String(entity)}.${String(state)}`} {...props}>
      {labels[locale] ?? labels.en}
      {detail ? <span className="font-normal"> · {detail}</span> : null}
    </Badge>
  );
}
