"use client";
import type { ReactNode } from "react";

export function BulkActionBar({ label, selection, children, align = "center" }: { label: string; selection: ReactNode; children: ReactNode; align?: "center" | "end" }) {
  return <div role="region" aria-label={label} className={`flex flex-wrap gap-3 rounded-panel border border-line bg-brand-subtle p-3 ${align === "end" ? "items-end" : "items-center"}`}><p className="me-auto text-body font-semibold" aria-live="polite">{selection}</p>{children}</div>;
}
