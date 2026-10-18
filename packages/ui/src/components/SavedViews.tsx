"use client";
import { useState } from "react";
import { BookmarkSimple, Plus, X } from "@phosphor-icons/react";
import { Button } from "./Button.js";
import { Input } from "./Input.js";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
export type SavedView = { id: string; name: string; filters: Record<string, string> };
export function SavedViews({ views, selected, onSelect, onSave, onDelete }: { views: SavedView[]; selected?: string; onSelect: (view: SavedView) => void; onSave?: (name: string) => Promise<unknown> | void; onDelete?: (id: string) => void }) {
  const [name, setName] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const { locale } = useOrgtik(), t = (key: Parameters<typeof suiteText>[1]) => suiteText(locale, key);
  const save = async () => { if (!name.trim() || !onSave) return; setBusy(true); setError(undefined); try { await onSave(name.trim()); setName(""); } catch (failure) { setError(failure instanceof Error ? failure.message : t("retry")); } finally { setBusy(false); } };
  return <Popover><PopoverTrigger render={<Button size="sm" shape="control" variant="secondary" startIcon={<BookmarkSimple />}>{views.find(view => view.id === selected)?.name || t("savedViews")}</Button>} /><PopoverContent align="start" className="w-72"><div className="flex flex-col gap-2"><p className="text-body-sm font-semibold">{t("savedViews")}</p>{views.map(view => <div key={view.id} className="flex items-center gap-1"><Button shape="control" size="sm" variant={view.id === selected ? "secondary" : "ghost"} className="flex-1 justify-start" onClick={() => onSelect(view)}>{view.name}</Button>{onDelete ? <Button size="xs" variant="ghost" shape="control" onClick={() => onDelete(view.id)} aria-label={`${t("remove")} ${view.name}`}><X aria-hidden="true" /></Button> : null}</div>)}{onSave ? <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3"><Input size="sm" value={name} onChange={event => setName(event.target.value)} aria-label={t("viewName")} /><Button size="sm" shape="control" loading={busy} disabled={!name.trim()} startIcon={<Plus />} onClick={save}>{t("saveView")}</Button></div> : null}{error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}</div></PopoverContent></Popover>;
}
