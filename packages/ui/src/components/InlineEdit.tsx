"use client";
import { useEffect, useRef, useState } from "react";
import { PencilSimple, Check, X } from "@phosphor-icons/react";
import { Input } from "./Input.js";
import { IconButton } from "./IconButton.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
export function InlineEdit({ value, label, onSave, disabled, validate, placeholder }: { value: string; label: string; onSave: (value: string) => Promise<unknown> | void; disabled?: boolean; validate?: (value: string) => string | undefined; placeholder?: string }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(value), [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null), { locale } = useOrgtik();
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const save = async () => { const problem = validate?.(draft); if (problem) { setError(problem); return; } setBusy(true); setError(undefined); try { await onSave(draft); setEditing(false); } catch (failure) { setError(failure instanceof Error ? failure.message : suiteText(locale, "retry")); } finally { setBusy(false); } };
  if (!editing) return <button type="button" disabled={disabled} aria-label={label} onClick={() => setEditing(true)} className="group inline-flex min-w-0 items-center gap-2 rounded-field px-1 py-1 text-start text-body hover:bg-hover disabled:cursor-default"><span dir="auto" className="truncate">{value || placeholder}</span>{!disabled ? <PencilSimple aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" /> : null}</button>;
  return <div className="flex min-w-0 flex-col gap-1"><div className="flex items-center gap-1"><Input ref={input} size="sm" value={draft} aria-label={label} disabled={busy} aria-invalid={Boolean(error)} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void save(); } if (event.key === "Escape" && !busy) setEditing(false); }} /><IconButton size="sm" label={suiteText(locale, "save")} icon={<Check />} disabled={busy} onClick={save} /><IconButton size="sm" label={suiteText(locale, "cancel")} icon={<X />} disabled={busy} onClick={() => setEditing(false)} /></div>{error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}</div>;
}
