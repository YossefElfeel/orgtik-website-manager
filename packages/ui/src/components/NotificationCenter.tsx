"use client";
import { useEffect, useState } from "react";
import { Bell } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover.js";
import { IconButton } from "./IconButton.js";
import { Button } from "./Button.js";
import { Skeleton } from "./Display.js";
import { useFormatter, useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
import type { SuiteNotification } from "../suite/types.js";
const EMPTY_ITEMS: SuiteNotification[] = [];
export function NotificationCenter({ items = EMPTY_ITEMS, load, onRead, onReadAll, onSelect }: { items?: SuiteNotification[]; load?: () => Promise<SuiteNotification[]>; onRead?: (id: string) => Promise<unknown>; onReadAll?: () => Promise<unknown>; onSelect: (item: SuiteNotification) => Promise<unknown> | void }) {
  const [open, setOpen] = useState(false), [records, setRecords] = useState(items), [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const { locale } = useOrgtik(), f = useFormatter(), t = (key: Parameters<typeof suiteText>[1]) => suiteText(locale, key);
  useEffect(() => setRecords(items), [items]);
  useEffect(() => { if (!open || !load) return; let live = true; setBusy(true); setError(undefined); load().then(data => { if (live) setRecords(data); }).catch(failure => { if (live) setError(failure instanceof Error ? failure.message : t("retry")); }).finally(() => { if (live) setBusy(false); }); return () => { live = false; }; }, [open, load]);
  const unread = records.filter(item => !item.read).length;
  const readAll = async () => { setBusy(true); setError(undefined); try { await onReadAll?.(); setRecords(previous => previous.map(item => ({ ...item, read: true }))); } catch (failure) { setError(failure instanceof Error ? failure.message : t("retry")); } finally { setBusy(false); } };
  const choose = async (item: SuiteNotification) => { setError(undefined); try { if (!item.read && onRead) await onRead(item.id); await onSelect(item); setRecords(previous => previous.map(record => record.id === item.id ? { ...record, read: true } : record)); setOpen(false); } catch (failure) { setError(failure instanceof Error ? failure.message : t("retry")); } };
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger render={<IconButton label={`${t("notifications")}${unread ? ` (${f.number(unread)})` : ""}`} icon={<span className="relative"><Bell />{unread ? <span className="absolute -end-0.5 -top-0.5 size-1.5 rounded-pill bg-danger-solid" /> : null}</span>} />} /><PopoverContent align="end" className="w-96"><header className="flex items-center justify-between gap-3"><h2 className="text-body font-semibold">{t("notifications")}</h2>{unread && onReadAll ? <Button size="xs" variant="ghost" shape="control" disabled={busy} onClick={readAll}>{t("markAll")}</Button> : null}</header>{error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}{busy ? <Skeleton className="h-20" /> : null}<ul className="max-h-96 space-y-1 overflow-y-auto">{records.map(item => <li key={item.id}><button type="button" onClick={() => choose(item)} className={`flex w-full flex-col gap-1 rounded-field p-3 text-start hover:bg-hover ${!item.read ? "bg-brand-subtle" : ""}`}><span dir="auto" className="text-body-sm font-semibold">{item.title}</span>{item.subtitle ? <span dir="auto" className="text-caption text-fg-muted">{item.subtitle}</span> : null}<time dateTime={item.at} className="text-caption text-fg-subtle">{f.date(item.at, { dateStyle: "medium", timeStyle: "short" })}</time></button></li>)}</ul>{!busy && !records.length ? <p className="py-6 text-center text-body-sm text-fg-muted">{t("allCaughtUp")}</p> : null}</PopoverContent></Popover>;
}
