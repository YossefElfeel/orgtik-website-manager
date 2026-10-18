"use client";
import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { Input } from "./Input.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
export function TagInput({ label, value, onChange, placeholder, disabled, max = 20 }: { label: string; value: string[]; onChange: (tags: string[]) => void; placeholder?: string; disabled?: boolean; max?: number }) {
  const [draft, setDraft] = useState(""), { locale } = useOrgtik();
  const add = () => { const next = draft.trim().replace(/,$/, ""); if (next && !value.includes(next) && value.length < max) onChange([...value, next]); setDraft(""); };
  return <div className="flex flex-col gap-2"><Input aria-label={label} value={draft} disabled={disabled || value.length >= max} placeholder={placeholder} onChange={event => setDraft(event.target.value)} onBlur={add} onKeyDown={event => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); } }} />
    {value.length ? <ul aria-label={label} className="flex flex-wrap gap-1.5">{value.map(tag => <li key={tag} className="flex items-center gap-1 rounded-pill bg-brand-subtle ps-2.5 pe-1 py-1 text-caption text-fg-brand"><span dir="auto">{tag}</span><button type="button" aria-label={`${suiteText(locale, "remove")} ${tag}`} disabled={disabled} onClick={() => onChange(value.filter(item => item !== tag))} className="grid size-5 place-items-center rounded-pill hover:bg-hover disabled:opacity-50"><X aria-hidden="true" /></button></li>)}</ul> : null}
  </div>;
}
