"use client";
import { useState } from "react";
import { CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { Button } from "../components/Button.js";
import { Badge } from "../components/Badge.js";
import { Field } from "../components/Field.js";
import { Input } from "../components/Input.js";
import { EmptyState } from "../components/States.js";
import { SimulatedTag } from "../demo/DemoPanel.js";
import { prototypeWord } from "./strings.js";
import { cn } from "../lib/cn.js";

export function UsageMeter({ label, used, limit, unit, warnings = true, valueText }: { label: string; used: number; limit: number; unit?: string; warnings?: boolean; valueText?: string }) {
  const { locale } = useOrgtik(), percent = limit > 0 ? Math.min(100, Math.max(0, used / limit * 100)) : 100;
  const f = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const status = warnings ? used >= limit ? "reached" : percent >= 80 ? "approaching" : null : null;
  return <div className="flex flex-col gap-2 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-body font-semibold">{label}</span><span className="text-body-sm tabular-nums text-fg-muted">{valueText ?? `${f.format(used)} ${prototypeWord(locale, "usedOf")} ${f.format(limit)} ${unit ?? ""}`}</span></div>
    <div role="progressbar" aria-label={label} aria-valuenow={Math.min(limit, Math.max(0, used))} aria-valuemin={0} aria-valuemax={limit} aria-valuetext={`${f.format(used)} / ${f.format(limit)} ${unit ?? ""}`} className="h-2 overflow-hidden rounded-pill bg-sunken"><div className={cn("h-full rounded-pill", status === "reached" ? "bg-danger" : status === "approaching" ? "bg-warning" : "bg-action-primary")} style={{ width: `${percent}%` }} /></div>
    {status ? <p className={cn("text-caption", status === "reached" ? "text-danger" : "text-fg-muted")}>{prototypeWord(locale, status)}</p> : null}
  </div>;
}

export type AuditEntry = { id: string; actor: string; action: string; target: string; at: string; simulated?: boolean };
export function AuditLogTable({ entries }: { entries: AuditEntry[] }) {
  const { locale } = useOrgtik(), [query, setQuery] = useState("");
  const visible = entries.filter(entry => `${entry.actor} ${entry.action} ${entry.target}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const t = (key: Parameters<typeof prototypeWord>[1]) => prototypeWord(locale, key);
  return <div className="flex flex-col gap-4"><Field label={t("search")}><Input value={query} onChange={event => setQuery(event.target.value)} /></Field>{visible.length ? <div className="overflow-x-auto rounded-panel border border-line"><table className="w-full text-start text-body-sm"><caption className="sr-only">{t("audit")}</caption><thead className="bg-sunken text-fg-muted"><tr>{["actor", "action", "target", "when"].map(key => <th key={key} scope="col" className="px-4 py-3 text-start font-semibold">{t(key as "actor")}</th>)}</tr></thead><tbody className="divide-y divide-line">{visible.map(entry => <tr key={entry.id}><td className="px-4 py-3 whitespace-nowrap" dir="auto">{entry.actor}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><span>{entry.action}</span>{entry.simulated ? <SimulatedTag /> : null}</div></td><td className="px-4 py-3" dir="auto">{entry.target}</td><td className="px-4 py-3 whitespace-nowrap tabular-nums">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(entry.at))}</td></tr>)}</tbody></table></div> : <EmptyState title={t("noActivity")} size="compact" />}</div>;
}

/** Pure presentation flow: the code is fixed and no identity/session API is called. */
export function TwoFactorScreens({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  const { locale } = useOrgtik(), [step, setStep] = useState<"overview" | "code" | "recovery">("overview"), [code, setCode] = useState(""), [error, setError] = useState(false);
  const t = (key: Parameters<typeof prototypeWord>[1]) => prototypeWord(locale, key);
  const download = () => { const blob = new Blob(["OrgTik simulated recovery examples — no account access\nDEMO-1111\nDEMO-2222\nDEMO-3333\n"], { type: "text/plain;charset=utf-8" }), url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "orgtik-demo-recovery.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <section aria-label={t("twoFactor")} className="flex flex-col gap-4 rounded-panel border border-line bg-raised p-5">
    <div className="flex flex-wrap items-center gap-2"><ShieldCheck aria-hidden="true" className="size-5 text-fg-brand" /><h2 className="font-display text-title-sm">{t("twoFactor")}</h2><SimulatedTag /></div>
    <p className="max-w-prose text-body text-fg-muted">{t("twoFactorNote")}</p>
    {step === "overview" ? <><Badge className="self-start" tone={enabled ? "success" : "neutral"}>{t(enabled ? "enabled" : "disabled")}</Badge><div><Button variant={enabled ? "secondary" : "primary"} onClick={() => { if (enabled) onChange(false); else { setCode(""); setError(false); setStep("code"); } }}>{t(enabled ? "disable" : "setup")}</Button></div></> : null}
    {step === "code" ? <form className="flex max-w-md flex-col gap-4" onSubmit={event => { event.preventDefault(); if (code !== "123456") { setError(true); return; } onChange(true); setStep("recovery"); }}><Field label={t("code")} description={t("codeHelp")} error={error ? t("codeError") : undefined}><Input dir="ltr" inputMode="numeric" autoComplete="off" maxLength={6} value={code} onChange={event => { setCode(event.target.value); setError(false); }} /></Field><div className="flex flex-wrap gap-2"><Button type="submit">{t("verify")}</Button><Button variant="secondary" onClick={() => setStep("overview")}>{t("cancel")}</Button></div></form> : null}
    {step === "recovery" ? <div className="flex flex-col gap-3"><div className="flex items-center gap-2"><CheckCircle aria-hidden="true" className="size-5 text-success" /><h3 className="text-body font-semibold">{t("recovery")}</h3></div><p className="max-w-prose text-body-sm text-fg-muted">{t("recoveryHelp")}</p><div dir="ltr" className="flex flex-wrap gap-2">{["DEMO-1111", "DEMO-2222", "DEMO-3333"].map(value => <code key={value} className="rounded-field bg-sunken px-3 py-2 text-body-sm">{value}</code>)}</div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={download}>{t("download")}</Button><Button onClick={() => setStep("overview")}>{t("done")}</Button></div></div> : null}
  </section>;
}
