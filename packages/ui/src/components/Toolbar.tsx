"use client";
import type { ReactNode } from "react";
import { MagnifyingGlass, ListBullets, Rows } from "@phosphor-icons/react";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { Input } from "./Input.js";
import { IconButton } from "./IconButton.js";
import { cn } from "../lib/cn.js";

export type Density = "comfortable" | "compact";
export type ToolbarProps = {
  label: string;
  search?: { value: string; onChange: (value: string) => void; label: string; placeholder?: string };
  filters?: ReactNode;
  actions?: ReactNode;
  density?: Density;
  onDensityChange?: (value: Density) => void;
  children?: ReactNode;
  className?: string;
};
const copy = {
  en: { comfortable: "Comfortable density", compact: "Compact density" },
  ar: { comfortable: "كثافة مريحة", compact: "كثافة مدمجة" },
  de: { comfortable: "Komfortable Dichte", compact: "Kompakte Dichte" },
  fr: { comfortable: "Densité confortable", compact: "Densité compacte" },
  it: { comfortable: "Densità confortevole", compact: "Densità compatta" },
};
export function Toolbar({ label, search, filters, actions, density = "comfortable", onDensityChange, children, className }: ToolbarProps) {
  const { locale } = useOrgtik();
  return (
    <section aria-label={label} className={cn("flex flex-wrap items-center gap-2 rounded-field border border-line bg-raised p-2 shadow-xs", className)}>
      {search ? <div className="min-w-40 flex-1 sm:max-w-80"><Input type="search" value={search.value} onChange={event => search.onChange(event.target.value)} aria-label={search.label} placeholder={search.placeholder ?? search.label} startIcon={<MagnifyingGlass />} /></div> : null}
      {filters}
      {children}
      <div className="ms-auto flex flex-wrap items-center gap-2">
        {actions}
        {onDensityChange ? <div className="flex items-center gap-1 border-s border-line ps-2">
          <IconButton size="sm" label={copy[locale].comfortable} icon={<Rows />} aria-pressed={density === "comfortable"} onClick={() => onDensityChange("comfortable")} className={density === "comfortable" ? "bg-brand-subtle text-fg-brand" : undefined} />
          <IconButton size="sm" label={copy[locale].compact} icon={<ListBullets />} aria-pressed={density === "compact"} onClick={() => onDensityChange("compact")} className={density === "compact" ? "bg-brand-subtle text-fg-brand" : undefined} />
        </div> : null}
      </div>
    </section>
  );
}
