"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../components/Button.js";
import { Card, CardHeader } from "../components/Display.js";
import { Stat } from "../components/Stat.js";
import { Select } from "../components/Select.js";
import { Checkbox } from "../components/Checkbox.js";
import { InlineEdit } from "../components/InlineEdit.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { Toolbar } from "../components/Toolbar.js";
import { ActivityTimeline } from "../components/ActivityTimeline.js";
import { LoadingState, ErrorState, NoPermissionState, EmptyState } from "../components/States.js";
import { useOrgtik, useFormatter } from "../provider/OrgtikProvider.js";
import { ToolAdminLayout, type ToolAdminSection } from "./ToolAdminLayout.js";
import { SUITE_TOOLS, suiteMetricLabel } from "./registry.js";
import { suiteText } from "./strings.js";
import { suiteRequest, SuiteRequestError } from "./api.js";
import { useSuite } from "./useSuite.js";
import type { SuiteToolAdminData, SuiteActivity, ToolKey } from "./types.js";

/** Shared current-tool controls; domain-specific import and settings stay in the owning app. */
export function ToolAdminScreen({ tool, active = "overview", basePath = "/admin", children }: { tool: ToolKey; active?: ToolAdminSection; basePath?: string; children?: ReactNode }) {
  const suite = useSuite(), { locale, Link } = useOrgtik(), f = useFormatter();
  const t = (key: Parameters<typeof suiteText>[1]) => suiteText(locale, key);
  const [data, setData] = useState<SuiteToolAdminData>(), [activity, setActivity] = useState<SuiteActivity[]>([]), [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false), [query, setQuery] = useState(""), [saved, setSaved] = useState(false);
  const apiUrl = suite.apiUrl, workspaceId = suite.snapshot?.workspace.id, token = suite.session?.tokens.accessToken;
  const load = async () => { if (!apiUrl) return; setError(undefined); setData(await suiteRequest<SuiteToolAdminData>(apiUrl, `/tools/${tool}/admin`)); if (active === "audit") setActivity(await suiteRequest<SuiteActivity[]>(apiUrl, `/tools/${tool}/admin/audit`)); };
  useEffect(() => {
    let cancelled = false; setData(undefined); setError(undefined); setSaved(false);
    if (apiUrl && token && workspaceId) {
      suiteRequest<SuiteToolAdminData>(apiUrl, `/tools/${tool}/admin`).then(value => { if (!cancelled) setData(value); }, failure => { if (!cancelled) setError(failure); });
      if (active === "audit") suiteRequest<SuiteActivity[]>(apiUrl, `/tools/${tool}/admin/audit`).then(value => { if (!cancelled) setActivity(value); }, failure => { if (!cancelled) setError(failure); });
    }
    return () => { cancelled = true; };
  }, [apiUrl, token, workspaceId, tool, active]);
  const change = async (path: string, body: unknown) => { setBusy(true); setError(undefined); setSaved(false); try { await suite.mutate(path, "PATCH", body); await load(); setSaved(true); } catch (failure) { setError(failure); throw failure; } finally { setBusy(false); } };
  const exportData = async () => { setBusy(true); setError(undefined); try { const value = await suite.request(`/tools/${tool}/export`), url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })), anchor = document.createElement("a"); anchor.href = url; anchor.download = `${workspaceId}-${tool}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setSaved(true); } catch (failure) { setError(failure); } finally { setBusy(false); } };
  if (error && !data) return error instanceof SuiteRequestError && [401, 403].includes(error.status) ? <NoPermissionState title={t("denied")} action={<Link href={suite.sosUrl || "/"}>{t("home")}</Link>} /> : <ErrorState onRetry={() => void load().catch(setError)} />;
  if (!data) return <LoadingState rows={4} />;
  const readOnly = !data.canWrite, members = data.members.filter(member => member.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <ToolAdminLayout tool={tool} active={active} basePath={basePath} allow><div className="flex min-w-0 flex-col gap-5">
    {readOnly ? <p role="status" className="rounded-field bg-sunken p-3 text-body-sm text-fg-muted">{suite.snapshot?.actor.readOnly ? t("preview") : t("readonly")}</p> : null}
    {error ? <ErrorState size="compact" onRetry={() => void load().catch(setError)} /> : null}
    {saved ? <p role="status" className="text-body-sm text-success">{t("saved")}</p> : null}
    {active === "overview" || active === "billing" ? <><div className="grid gap-4 sm:grid-cols-2"><Stat label={t("plan")} value={data.plan?.name || "—"} /><Stat label={t("seats")} value={`${f.number(data.seats.assigned)}${data.seats.capacity === null ? "" : ` / ${f.number(data.seats.capacity)}`}`} /></div><Card><CardHeader title={t("usage")} />{Object.entries(data.plan?.usage || {}).map(([key, value]) => <div key={key} className="flex flex-wrap justify-between gap-3 border-b border-line py-3 last:border-0"><span className="text-body-sm text-fg-muted">{suiteMetricLabel(locale, key)}</span><span className="font-mono text-body-sm">{f.number(value)}{data.plan?.limits[key] !== undefined ? ` / ${f.number(data.plan.limits[key])}` : ""}</span></div>)}</Card>{suite.isOwner ? <Button onClick={() => window.location.assign(`${suite.sosUrl || ""}/billing`)}>{t("billing")}</Button> : null}</> : null}
    {active === "members" || active === "roles" ? <><Toolbar label={t("members")} search={{ value: query, onChange: setQuery, label: t("searchPeople") }} />{members.length ? <div className="divide-y divide-line rounded-card border border-line bg-raised">{members.map(member => <div key={member.id} className="flex flex-wrap items-center gap-3 p-4"><p dir="auto" className="min-w-0 flex-1 text-body-sm font-semibold">{member.name}</p>{member.assigned ? <><Select size="sm" aria-label={`${t("role")} · ${member.name}`} value={member.roles[0]} options={(member.allowedRoles || data.roles).map(role => ({ value: role, label: role.replaceAll("_", " ") }))} disabled={readOnly || busy || !member.userId} onValueChange={role => { if (role) void change(`/tools/${tool}/admin/members/${member.userId}`, { roles: [role] }).catch(() => {}); }} /><ConfirmDialog trigger={<Button variant="ghost" size="sm" disabled={readOnly || busy || member.userId === suite.session?.user.id}>{t("removeAccess")}</Button>} title={`${t("removeAccess")} · ${member.name}`} impact={SUITE_TOOLS[tool].labels[locale]} confirmLabel={t("removeAccess")} onConfirm={() => change(`/tools/${tool}/admin/members/${member.userId}`, { assigned: false })} /></> : <Button size="sm" shape="control" disabled={readOnly || busy || !member.userId || !member.allowedRoles.length || data.seats.available === 0} onClick={() => void change(`/tools/${tool}/admin/members/${member.userId}`, { assigned: true, roles: [member.allowedRoles.find(role => !["super_admin", "admin", "owner", "project_manager", "manager", "hr", "marketing_manager"].includes(role)) || member.allowedRoles[0]] }).catch(() => {})}>{t("assign")}</Button>}</div>)}</div> : <EmptyState title={t("noPeople")} action={<Button variant="ghost" onClick={() => setQuery("")}>{t("members")}</Button>} />}</> : null}
    {active === "settings" ? <Card><CardHeader title={t("settings")} /><div className="mt-4 flex flex-col gap-5"><InlineEdit value={data.settings.name || SUITE_TOOLS[tool].labels[locale]} label={t("name")} disabled={readOnly} onSave={name => change(`/tools/${tool}/admin/settings`, { ...data.settings, name })} /><InlineEdit value={data.settings.description || ""} label={t("description")} disabled={readOnly} onSave={description => change(`/tools/${tool}/admin/settings`, { ...data.settings, description })} />{children}</div></Card> : null}
    {active === "connections" ? <div className="flex flex-col gap-3">{data.connectors.map(connector => <Card key={connector.id}><CardHeader title={`${SUITE_TOOLS[connector.source].labels[locale]} · ${SUITE_TOOLS[connector.target].labels[locale]}`} /><div className="mt-3 flex flex-wrap items-center justify-between gap-4"><p className="text-body-sm text-fg-muted">{connector.data?.join(" · ")}</p><Checkbox label={t("enabled")} checked={connector.enabled} disabled={readOnly || busy || !suite.canAdmin(connector.source) && !["owner", "admin"].includes(suite.snapshot?.member.role || "")} onCheckedChange={enabled => void change(`/connectors/${connector.id}`, { enabled: Boolean(enabled) }).catch(() => {})} /></div></Card>)}</div> : null}
    {active === "import-export" ? <Card><CardHeader title={t("importExport")} /><div className="mt-4 flex flex-col items-start gap-4"><Button loading={busy} onClick={() => void exportData()}>{t("exportData")}</Button>{children}</div></Card> : null}
    {active === "audit" ? activity.length ? <ActivityTimeline items={activity} label={t("audit")} /> : <EmptyState title={t("noActivity")} action={<Button variant="ghost" onClick={() => void load().catch(setError)}>{t("audit")}</Button>} /> : null}
  </div></ToolAdminLayout>;
}
