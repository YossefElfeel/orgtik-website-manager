"use client";
import type { ReactNode } from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { formatLocale } from "../locale.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
import { Select } from "./Select.js";

// Tabs ---------------------------------------------------------------------------------------

export const Tabs = BaseTabs.Root;
export const TabsPanel = BaseTabs.Panel;

export type TabItem = { value: string; label: ReactNode; count?: number; disabled?: boolean };

/**
 * The tab row. `line` sits on a page (an underline marks the current tab); `contained` sits
 * inside a card or toolbar; `side` is a column beside the panel, for more tabs than fit in a row
 * (put `orientation="vertical"` on <Tabs> so the arrow keys go up and down). Arrow keys follow the
 * reading direction (spike-verified).
 */
export function TabsList({ items, variant = "line", className }: { items: TabItem[]; variant?: "line" | "contained" | "side"; className?: string }) {
  const { digits, locale } = useOrgtik();
  const count = new Intl.NumberFormat(formatLocale(locale, digits));
  const line = variant === "line";
  if (variant === "side")
    return (
      <BaseTabs.List className={cn("flex flex-col gap-0.5", className)}>
        {items.map((item) => (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              "flex min-h-control-md w-full items-center justify-between gap-2 rounded-field px-3 py-2 text-start font-body text-body-sm text-fg-muted outline-hidden select-none",
              "transition-colors duration-(--ot-duration-fast) ease-ot-out hover:bg-hover hover:text-fg",
              "data-[active]:bg-brand-subtle data-[active]:font-semibold data-[active]:text-fg-brand",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            )}
          >
            <span className="min-w-0">{item.label}</span>
            {item.count !== undefined ? (
              <span className="shrink-0 rounded-pill bg-sunken px-1.5 text-micro text-fg-muted tabular-nums">{count.format(item.count)}</span>
            ) : null}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
    );
  return (
    <BaseTabs.List
      className={cn(
        "relative flex max-w-full items-center overflow-x-auto",
        line ? "gap-5 border-b border-line" : "gap-1 rounded-pill bg-sunken p-1",
        className,
      )}
    >
      {items.map((item) => (
        <BaseTabs.Tab
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          className={cn(
            "relative z-[1] inline-flex shrink-0 items-center gap-2 font-body text-body font-semibold whitespace-nowrap text-fg-muted outline-hidden select-none",
            "transition-colors duration-(--ot-duration-fast) ease-ot-out hover:text-fg data-[active]:text-fg",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            line ? "h-control-md" : "h-control-sm rounded-pill px-3.5",
          )}
        >
          {item.label}
          {item.count !== undefined ? (
            <span className="rounded-pill bg-sunken px-1.5 text-micro text-fg-muted tabular-nums">{count.format(item.count)}</span>
          ) : null}
        </BaseTabs.Tab>
      ))}
      {/* Base UI measures the active tab in physical pixels; these stay physical on purpose. */}
      <BaseTabs.Indicator
        style={{ left: "var(--active-tab-left)", width: "var(--active-tab-width)" }}
        className={cn(
          "absolute transition-[left,width] duration-(--ot-duration-base) ease-ot-out",
          line ? "bottom-0 h-0.5 rounded-pill bg-fg-brand" : "top-1 h-[calc(100%-8px)] rounded-pill bg-raised shadow-raised",
        )}
      />
    </BaseTabs.List>
  );
}

// Pagination ---------------------------------------------------------------------------------

/** Page numbers to show: always the first and last, the current and its neighbours, gaps as null. */
export function pageWindow(page: number, pages: number): Array<number | null> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push(p - sorted[i - 1]! === 2 ? p - 1 : null);
    out.push(p);
  });
  return out;
}

export type PaginationProps = {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange?: (page: number) => void;
  /** Shows the rows-per-page choice (10 by default). */
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
  /** For URL-synced lists: pages render as real links, so they can be opened and shared. */
  hrefFor?: (page: number) => string;
  className?: string;
};

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizes = [10], hrefFor, className }: PaginationProps) {
  const t = useStrings();
  const { Link } = useOrgtik();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const cell =
    "inline-grid h-control-sm min-w-control-sm place-items-center rounded-pill px-2 text-body-sm font-semibold tabular-nums text-fg transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus";

  const go = (target: number, content: ReactNode, label: string, extra?: string) => {
    const disabled = target < 1 || target > pages;
    if (hrefFor && !disabled) {
      return (
        <Link href={hrefFor(target)} className={cn(cell, extra)}>
          <span aria-hidden={label ? "true" : undefined}>{content}</span>
          {label ? <span className="sr-only">{label}</span> : null}
        </Link>
      );
    }
    return (
      <button type="button" aria-label={label || undefined} disabled={disabled} onClick={() => onPageChange?.(target)} className={cn(cell, "disabled:pointer-events-none disabled:opacity-40", extra)}>
        {content}
      </button>
    );
  };

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-body-sm text-fg-muted", className)}>
      <div className="flex items-center gap-4">
        <span className="tabular-nums" aria-live="polite">
          {t("showingRange", { from, to, total })}
        </span>
        {onPageSizeChange ? (
          <span className="flex items-center gap-2">
            <span>{t("rowsPerPage")}</span>
            <Select
              size="sm"
              aria-label={t("rowsPerPage")}
              value={String(pageSize)}
              onValueChange={(v) => v && onPageSizeChange(Number(v))}
              options={pageSizes.map((n) => ({ value: String(n), label: String(n) }))}
              className="w-20"
            />
          </span>
        ) : null}
      </div>
      <nav aria-label={t("pagination")} className="flex items-center gap-1">
        {go(page - 1, <CaretLeft className="size-4 rtl:-scale-x-100" />, t("previousPage"))}
        {pageWindow(page, pages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-fg-subtle">
              …
            </span>
          ) : p === page ? (
            <span key={p} aria-current="page" className={cn(cell, "bg-action-primary text-on-action-primary hover:bg-action-primary")}>
              {p}
            </span>
          ) : (
            <span key={p}>{go(p, p, t("pageOf", { page: p, pages }))}</span>
          ),
        )}
        {go(page + 1, <CaretRight className="size-4 rtl:-scale-x-100" />, t("nextPage"))}
      </nav>
    </div>
  );
}

// Breadcrumb and PageHeader ------------------------------------------------------------------

export type Crumb = { label: ReactNode; href?: string };

/** Where this page sits. The last crumb is the current page; the rest link up. */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  const t = useStrings();
  const { Link } = useOrgtik();
  return (
    <nav aria-label={t("breadcrumb")} className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-body-sm text-fg-muted">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center gap-1.5">
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className={cn("truncate", last && "text-fg")}>
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="truncate rounded-sm hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus">
                  {c.label}
                </Link>
              )}
              {last ? null : <CaretRight aria-hidden="true" className="size-3 shrink-0 text-fg-subtle rtl:-scale-x-100" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: Crumb[];
  /** A StatusBadge or similar, next to the title. */
  status?: ReactNode;
  meta?: ReactNode;
  tabs?: ReactNode;
  /** The page's actions. Put the primary one last, so it sits at the reading end. */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, breadcrumb, status, meta, tabs, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {breadcrumb?.length ? <Breadcrumb items={breadcrumb} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-title-lg text-fg">{title}</h1>
            {status}
          </div>
          {description ? <p className="max-w-[70ch] text-body text-fg-muted">{description}</p> : null}
          {meta ? <div className="flex flex-wrap items-center gap-3 text-caption text-fg-subtle">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs}
    </header>
  );
}
