"use client";
import { useState } from "react";
import { Button } from "../components/Button.js";
import { Textarea } from "../components/Input.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "./strings.js";
export function RequestAccess({ title, description, onRequest, reasonLabel, disabled }: { title: string; description?: string; onRequest: (reason: string) => Promise<unknown>; reasonLabel?: string; disabled?: boolean }) {
  const { locale } = useOrgtik(), [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState<string>();
  const request = async () => { setBusy(true); setError(undefined); try { await onRequest(reason.trim()); setSent(true); } catch (failure) { setError(failure instanceof Error ? failure.message : suiteText(locale, "retry")); } finally { setBusy(false); } };
  return <section className="flex flex-col gap-3 rounded-card border border-line bg-raised p-5 shadow-xs"><h3 className="text-body font-semibold">{title}</h3>{description ? <p className="text-body-sm text-fg-muted">{description}</p> : null}{sent ? <p role="status" className="text-body-sm text-success">{suiteText(locale, "pending")}</p> : <>{reasonLabel ? <Textarea aria-label={reasonLabel} placeholder={reasonLabel} maxLength={1000} value={reason} disabled={disabled || busy} onChange={event => setReason(event.target.value)} rows={2} /> : null}<Button size="sm" className="self-start" loading={busy} disabled={disabled} onClick={request}>{suiteText(locale, "request")}</Button></>}{error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}</section>;
}
