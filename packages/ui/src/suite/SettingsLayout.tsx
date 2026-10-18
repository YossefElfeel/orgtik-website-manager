"use client";
import type { ReactNode } from "react";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { PageHeader } from "../components/Navigation.js";
import { cn } from "../lib/cn.js";
export type SettingsSection = { id: string; label: string; href: string; icon?: ReactNode };
export function SettingsLayout({ title, description, sections, active, actions, children }: { title: string; description?: string; sections: SettingsSection[]; active: string; actions?: ReactNode; children: ReactNode }) {
  const { Link } = useOrgtik();
  return <div className="mx-auto flex w-full max-w-(--ot-layout-default) flex-col gap-6"><PageHeader title={title} description={description} actions={actions} /><div className="grid min-w-0 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]"><nav aria-label={title} className="flex flex-wrap gap-1 self-start lg:flex-col">{sections.map(section => <Link key={section.id} href={section.href} aria-current={section.id === active ? "page" : undefined} className={cn("flex min-h-9 items-center gap-2 rounded-field px-3 py-2 text-body-sm text-fg-muted hover:bg-hover", section.id === active && "bg-brand-subtle font-semibold text-fg-brand")}>{section.icon}<span>{section.label}</span></Link>)}</nav><div className="min-w-0">{children}</div></div></div>;
}
