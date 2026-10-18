"use client";
import type { ReactNode } from "react";
import { Progress as BaseProgress } from "@base-ui/react/progress";
import { Meter as BaseMeter } from "@base-ui/react/meter";
import { CheckCircle, Warning, WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { formatLocale } from "../locale.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";

const track = "h-2 w-full overflow-hidden rounded-pill bg-sunken";

/** How far a task has got (an upload, an import). `value` null means "working, amount unknown". */
export function Progress({ value, label, max = 100, className }: { value: number | null; label: ReactNode; max?: number; className?: string }) {
  const { locale, digits } = useOrgtik();
  return (
    <BaseProgress.Root value={value} max={max} locale={formatLocale(locale, digits)} className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-3 text-body-sm">
        <BaseProgress.Label className="text-fg">{label}</BaseProgress.Label>
        <BaseProgress.Value className="text-fg-muted tabular-nums" />
      </div>
      <BaseProgress.Track className={track}>
        <BaseProgress.Indicator className="block h-full rounded-pill bg-action-primary transition-[width] duration-(--ot-duration-base) data-[indeterminate]:w-1/3 data-[indeterminate]:animate-pulse" />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}

/** A measurement in a known range (storage used, a score). Not for progress over time. */
export function Meter({ value, label, min = 0, max = 100, format, className }: { value: number; label: ReactNode; min?: number; max?: number; format?: Intl.NumberFormatOptions; className?: string }) {
  const { locale, digits } = useOrgtik();
  return (
    <BaseMeter.Root value={value} min={min} max={max} format={format} locale={formatLocale(locale, digits)} className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-3 text-body-sm">
        <BaseMeter.Label className="text-fg">{label}</BaseMeter.Label>
        <BaseMeter.Value className="text-fg-muted tabular-nums" />
      </div>
      <BaseMeter.Track className={track}>
        <BaseMeter.Indicator className="block h-full rounded-pill bg-fg-brand" />
      </BaseMeter.Track>
    </BaseMeter.Root>
  );
}

export type LimitState = "ok" | "near" | "full" | "over";

/** The spec's limit states: OK below 80%, near from 80%, full at the limit, over past it. */
export function limitState(used: number, limit: number): LimitState {
  if (limit <= 0) return used > 0 ? "over" : "full";
  if (used > limit) return "over";
  if (used === limit) return "full";
  return used / limit >= 0.8 ? "near" : "ok";
}

const LIMIT_STYLE: Record<LimitState, { bar: string; text: string; icon: ReactNode }> = {
  ok: { bar: "bg-action-primary", text: "text-fg-muted", icon: null },
  near: { bar: "bg-warning-solid", text: "text-warning", icon: <Warning weight="fill" /> },
  full: { bar: "bg-danger-solid", text: "text-danger", icon: <WarningCircle weight="fill" /> },
  over: { bar: "bg-danger-solid", text: "text-danger", icon: <WarningCircle weight="fill" /> },
};

/**
 * Use against a plan's limit (seats, storage, projects). The state is spoken, not only coloured,
 * and past 80% it says what to do next through `action` (e.g. "Add seats"). The bar never draws
 * past full; "over" says by how much.
 */
export function LimitMeter({
  used,
  limit,
  label,
  unit,
  action,
  className,
}: {
  used: number;
  limit: number;
  label: ReactNode;
  /** Formats the numbers, e.g. (n) => f.bytes(n) for storage. */
  unit?: (n: number) => string;
  action?: ReactNode;
  className?: string;
}) {
  const t = useStrings();
  const { locale, digits } = useOrgtik();
  const state = limitState(used, limit);
  const style = LIMIT_STYLE[state];
  const show = unit ?? ((n: number) => new Intl.NumberFormat(formatLocale(locale, digits)).format(n));
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
  const words = { ok: null, near: t("limitNear"), full: t("limitFull"), over: t("limitOver", { amount: show(used - limit) }) }[state];
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-limit={state}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-body-sm">
        <span className="text-fg">{label}</span>
        <span className="tabular-nums text-fg-muted">{t("limitOf", { used: show(used), limit: show(limit) })}</span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={`${t("limitOf", { used: show(used), limit: show(limit) })}${words ? `. ${words}` : ""}`}
        aria-label={typeof label === "string" ? label : undefined}
        className={track}
      >
        <span className={cn("block h-full rounded-pill transition-[width] duration-(--ot-duration-base)", style.bar)} style={{ width: `${pct}%` }} />
      </div>
      {words || action ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {words ? (
            <span className={cn("inline-flex items-center gap-1.5 text-caption font-semibold [&_svg]:size-4", style.text)}>
              {style.icon}
              {words}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-caption text-fg-muted [&_svg]:size-4">
              <CheckCircle aria-hidden="true" />
            </span>
          )}
          {action}
        </div>
      ) : null}
    </div>
  );
}
