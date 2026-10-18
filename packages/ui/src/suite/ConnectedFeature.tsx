"use client";
import { useState, type ReactNode } from "react";
import { LinkSimple, LockSimple, Plugs, CreditCard } from "@phosphor-icons/react";
import { Button } from "../components/Button.js";
import { Skeleton } from "../components/Display.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { useSuite } from "./useSuite.js";
import { suiteText } from "./strings.js";
import { SUITE_TOOLS } from "./registry.js";
import type { ToolKey } from "./types.js";

export type ConnectedFeatureProps = { requires: ToolKey; source?: ToolKey; children: ReactNode; write?: boolean; targetWrite?: boolean; title?: string; compact?: boolean; onTrial?: () => Promise<unknown> | void; onRequestAccess?: () => Promise<unknown> | void; onRequestTool?: () => Promise<unknown> | void; billingHref?: string; settingsHref?: string };
export function ConnectedFeature({ requires, source, children, write = true, targetWrite = false, title, compact = false, onTrial, onRequestAccess, onRequestTool, billingHref, settingsHref }: ConnectedFeatureProps) {
  const suite = useSuite(), { locale, Link } = useOrgtik();
  const t = (key: Parameters<typeof suiteText>[1]) => suiteText(locale, key);
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState<string>();
  const state = suite.connectionState(requires, source, write, targetWrite);
  if (suite.loading) return <Skeleton className="h-24 w-full" />;
  if (state === "available") return <>{children}</>;
  const action = state === "not_subscribed" ? suite.isOwner ? onTrial : onRequestTool : state === "no_access" ? onRequestAccess : undefined;
  const run = async () => { if (!action || busy) return; setBusy(true); setError(undefined); try { await action(); if (state === "no_access" || !suite.isOwner) setSaved(true); } catch (failure) { setError(failure instanceof Error ? failure.message : t("retry")); } finally { setBusy(false); } };
  const preview = suite.snapshot?.actor.readOnly;
  const heading = title || t(state === "not_subscribed" ? "needsTool" : state === "no_access" ? "needsAccess" : state === "read_only" ? preview ? "preview" : "readonly" : state === "disabled" ? "disabled" : "denied");
  return <section aria-label={heading} className={`flex ${compact ? "flex-row items-center gap-3 p-3" : "flex-col items-start gap-3 p-5"} rounded-card border border-line bg-raised shadow-xs`}>
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-field bg-brand-subtle text-fg-brand">{state === "not_subscribed" ? <Plugs /> : state === "read_only" ? <CreditCard /> : state === "disabled" ? <LinkSimple /> : <LockSimple />}</span>
    <div className="min-w-0 flex-1"><h3 className="text-body font-semibold text-fg">{heading}</h3><p className="mt-1 text-body-sm text-fg-muted">{SUITE_TOOLS[requires].labels[locale]}{state === "no_access" ? ` · ${t("accessBody")}` : state === "read_only" && !preview ? ` · ${t("readonlyBody")}` : ""}</p>{saved ? <p role="status" className="mt-2 text-body-sm text-success">{t("pending")}</p> : null}{error ? <p role="alert" className="mt-2 text-body-sm text-danger">{error}</p> : null}</div>
    {!saved && action ? <Button size="sm" loading={busy} onClick={run}>{t(state === "not_subscribed" ? suite.isOwner ? "trial" : "requestTool" : "request")}</Button> : null}
    {state === "read_only" && suite.isOwner && !preview && billingHref ? <Link href={billingHref} className="rounded-pill bg-action-primary px-4 py-2 text-body-sm font-semibold text-on-action-primary">{t("billing")}</Link> : null}
    {state === "disabled" && settingsHref ? <Link href={settingsHref} className="text-body-sm text-fg-brand underline">{t("connectionSettings")}</Link> : null}
  </section>;
}
