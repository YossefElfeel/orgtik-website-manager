"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MagnifyingGlass, ArrowElbowDownLeft as ArrowReturnLeft } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle } from "./Dialog.js";
import { IconButton } from "./IconButton.js";
import { Input } from "./Input.js";
import { Kbd } from "./Kbd.js";
import { Skeleton } from "./Display.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
import type { SuiteSearchItem } from "../suite/types.js";

const EMPTY_ITEMS: SuiteSearchItem[] = [];
export function CommandPalette({ items = EMPTY_ITEMS, load, onSelect }: { items?: SuiteSearchItem[]; load?: (query: string, signal: AbortSignal) => Promise<SuiteSearchItem[]>; onSelect: (item: SuiteSearchItem) => Promise<unknown> | void }) {
  const { locale } = useOrgtik(), t = (key: Parameters<typeof suiteText>[1]) => suiteText(locale, key);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [results, setResults] = useState(items), [busy, setBusy] = useState(false), [active, setActive] = useState(0), [error, setError] = useState<string>();
  const id = useId(), input = useRef<HTMLInputElement>(null);
  useEffect(() => { const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(previous => !previous); } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setActive(0); setError(undefined);
      if (!load) { setResults(items.filter(item => `${item.title} ${item.subtitle || ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))); return; }
      setBusy(true);
      load(query, controller.signal).then(data => { if (!controller.signal.aborted) setResults(data); }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : t("retry")); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, items, load, locale]);
  const choose = async (item: SuiteSearchItem) => { setBusy(true); setError(undefined); try { await onSelect(item); setOpen(false); } catch (failure) { setError(failure instanceof Error ? failure.message : t("retry")); } finally { setBusy(false); } };
  return <><IconButton label={t("search")} icon={<MagnifyingGlass />} onClick={() => { setQuery(""); setOpen(true); }} /><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl p-0"><div className="border-b border-line p-4 pe-12"><DialogTitle className="sr-only">{t("search")}</DialogTitle><Input ref={input} type="search" role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={results[active] ? `${id}-${active}` : undefined} aria-label={t("search")} placeholder={t("search")} value={query} onChange={event => setQuery(event.target.value)} startIcon={<MagnifyingGlass />} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(results.length - 1, index + 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, index - 1)); } if (event.key === "Enter" && results[active] && !busy) { event.preventDefault(); void choose(results[active]); } }} /></div><div className="max-h-96 overflow-y-auto p-2">
    {busy ? <div aria-busy="true" className="space-y-2 p-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : null}
    {error ? <p role="alert" className="p-3 text-body-sm text-danger">{error}</p> : null}
    <ul id={id} role="listbox" aria-label={t("search")} className="flex flex-col gap-1">{results.map((item, index) => <li key={`${item.tool}:${item.id}`} role="none"><button id={`${id}-${index}`} role="option" aria-selected={active === index} type="button" onMouseEnter={() => setActive(index)} onClick={() => choose(item)} disabled={busy} className={`flex w-full items-center gap-3 rounded-field p-3 text-start ${active === index ? "bg-brand-subtle" : "hover:bg-hover"}`}><span className="min-w-0 flex-1"><span dir="auto" className="block truncate text-body font-semibold">{item.title}</span>{item.subtitle ? <span dir="auto" className="block truncate text-caption text-fg-muted">{item.subtitle}</span> : null}</span><span className="text-caption text-fg-subtle">{item.tool}</span><ArrowReturnLeft aria-hidden="true" className="size-4 text-fg-subtle" /></button></li>)}</ul>
    {!busy && !results.length ? <p className="p-6 text-center text-body-sm text-fg-muted">{t("noResults")}</p> : null}
  </div><footer className="flex items-center gap-2 border-t border-line px-4 py-3 text-caption text-fg-muted"><Kbd>Esc</Kbd>{t("close")}<span className="ms-auto"><Kbd>⌘</Kbd><Kbd>K</Kbd></span></footer></DialogContent></Dialog></>;
}
