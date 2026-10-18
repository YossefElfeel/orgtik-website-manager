"use client";
import type { ReactNode } from "react";
import { Plugs, ArrowRight } from "@phosphor-icons/react";
import { Button } from "../components/Button.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "./strings.js";
export function ConnectCard({ title, description, actionLabel, onConnect, children, disabled }: { title: string; description: string; actionLabel?: string; onConnect: () => void; children?: ReactNode; disabled?: boolean }) {
  const { locale } = useOrgtik();
  return <section className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-raised p-5 shadow-xs"><span aria-hidden="true" className="grid size-10 place-items-center rounded-field bg-brand-subtle text-fg-brand"><Plugs className="size-6" /></span><div className="min-w-0 flex-1"><h3 className="text-body font-semibold">{title}</h3><p className="mt-1 text-body-sm text-fg-muted">{description}</p>{children}</div><Button size="sm" variant="secondary" shape="control" disabled={disabled} endIcon={<ArrowRight className="rtl:-scale-x-100" />} onClick={onConnect}>{actionLabel || suiteText(locale, "connect")}</Button></section>;
}
