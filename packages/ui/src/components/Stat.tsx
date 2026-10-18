"use client";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useFormatter, useStrings } from "../provider/OrgtikProvider.js";
import { Skeleton } from "./Display.js";

export type StatChange = {
  /** The change as a ratio (0.12 is +12%), or an absolute amount with `format: "number"`. */
  value: number;
  format?: "percent" | "number";
  /** Which way is good news: visits up is good, response time up is not. Default "up". */
  good?: "up" | "down";
  /** What it's compared with ("vs the previous 30 days"). */
  against?: ReactNode;
};

/**
 * One figure with its label and, optionally, how it moved. The change says its direction in words
 * as well as with an arrow and a tone, so it doesn't depend on colour.
 */
export function Stat({
  label,
  value,
  change,
  hint,
  icon,
  loading,
  className,
  sparkline,
}: {
  label: ReactNode;
  value: ReactNode;
  change?: StatChange;
  hint?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
  sparkline?: number[];
}) {
  const t = useStrings();
  const f = useFormatter();
  const dir = !change || change.value === 0 ? "flat" : change.value > 0 ? "up" : "down";
  const good = change && dir !== "flat" && dir === (change.good ?? "up");
  const amount = change ? (change.format === "number" ? f.number(Math.abs(change.value)) : f.percent(Math.abs(change.value), 1)) : "";
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-card border border-line bg-raised p-5 shadow-xs", className)}>
      <div className="flex items-center gap-2 text-body-sm text-fg-muted">
        {icon ? <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center text-fg-subtle [&>svg]:size-5">{icon}</span> : null}
        <span className="min-w-0 truncate">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-24" />
      ) : (
        <div className="font-display text-title-lg text-fg tabular-nums">{value}</div>
      )}
      {change && !loading ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
          <span className={cn("inline-flex items-center gap-1 font-medium", dir === "flat" ? "text-fg-muted" : good ? "text-success" : "text-danger")}>
            <span aria-hidden="true" className="[&>svg]:size-4 rtl:[&>svg]:-scale-x-100">
              {dir === "up" ? <ArrowUpRight weight="bold" /> : dir === "down" ? <ArrowDownRight weight="bold" /> : <Minus weight="bold" />}
            </span>
            {dir === "flat" ? t("statFlat") : t(dir === "up" ? "statUp" : "statDown", { amount })}
          </span>
          {change.against ? <span className="text-fg-subtle">{change.against}</span> : null}
        </div>
      ) : null}
      {hint ? <p className="text-caption text-fg-subtle">{hint}</p> : null}
      {sparkline?.length && !loading ? <svg viewBox="0 0 120 28" aria-hidden="true" className="h-7 w-full text-fg-brand"><polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={sparkline.map((point,index) => `${2+index/(Math.max(1,sparkline.length-1))*116},${26-(point-Math.min(...sparkline))/Math.max(1,Math.max(...sparkline)-Math.min(...sparkline))*24}`).join(" ")} /></svg> : null}
    </div>
  );
}
