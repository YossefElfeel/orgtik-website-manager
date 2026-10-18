"use client";
import { EmptyState } from "../components/States.js";
import { SimulatedTag } from "../demo/DemoPanel.js";

export type MailboxPreviewEntry = { id: string; subject: string; recipient?: string; body?: string; at?: string };
export function MailboxPreview({ title, description, emptyTitle, entries, embedded = false }: { title: string; description: string; emptyTitle: string; entries: MailboxPreviewEntry[]; embedded?: boolean }) {
  return <section className={embedded ? "border-t border-line pt-4" : "rounded-panel border border-line bg-raised p-4"}><div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="text-title-sm font-semibold">{title}</h2><SimulatedTag /></div><p className="mb-4 max-w-prose text-body-sm text-fg-muted">{description}</p>{entries.length ? <ul className="divide-y divide-line">{entries.map(entry => <li key={entry.id} className="flex flex-col gap-2 py-3"><p className="text-body font-semibold" dir="auto">{entry.subject}</p>{entry.recipient ? <p className="break-words text-body-sm text-fg-muted"><bdi>{entry.recipient}</bdi></p> : null}{entry.body ? <p className="max-w-prose whitespace-pre-wrap break-words text-body-sm" dir="auto">{entry.body}</p> : null}{entry.at ? <p className="text-caption text-fg-muted"><bdi>{entry.at}</bdi></p> : null}</li>)}</ul> : <EmptyState size="compact" title={emptyTitle} />}</section>;
}
