"use client";
import { Avatar } from "./Display.js";
import { useFormatter, useOrgtik } from "../provider/OrgtikProvider.js";
import type { SuiteActivity } from "../suite/types.js";
export function ActivityTimeline({ items, label }: { items: SuiteActivity[]; label: string }) {
  const f = useFormatter(), { Link } = useOrgtik();
  return <ol aria-label={label} className="flex flex-col">{items.map((item, index) => <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">{index < items.length - 1 ? <span aria-hidden="true" className="absolute start-4 top-8 bottom-0 w-px bg-line" /> : null}<Avatar name={item.actor || item.title} size="sm" decorative /><div className="min-w-0 flex-1"><p className="text-body-sm font-semibold text-fg">{item.href ? <Link href={item.href} className="hover:underline">{item.title}</Link> : item.title}</p>{item.description ? <p dir="auto" className="mt-0.5 text-body-sm text-fg-muted">{item.description}</p> : null}<time dateTime={item.at} className="text-caption text-fg-subtle">{f.date(item.at, { dateStyle: "medium", timeStyle: "short" })}</time></div></li>)}</ol>;
}
