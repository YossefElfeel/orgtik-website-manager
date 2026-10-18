"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
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
import { ToolAdminLayout } from "./ToolAdminLayout.js";
import { SUITE_TOOLS, suiteMetricLabel } from "./registry.js";
import { suiteText } from "./strings.js";
import { suiteRequest, SuiteRequestError } from "./api.js";
import { useSuite } from "./useSuite.js";
/** Shared current-tool controls; domain-specific import and settings stay in the owning app. */
export function ToolAdminScreen({ tool, active = "overview", basePath = "/admin", children }) {
    const suite = useSuite(), { locale, Link } = useOrgtik(), f = useFormatter();
    const t = (key) => suiteText(locale, key);
    const [data, setData] = useState(), [activity, setActivity] = useState([]), [error, setError] = useState(), [busy, setBusy] = useState(false), [query, setQuery] = useState(""), [saved, setSaved] = useState(false);
    const apiUrl = suite.apiUrl, workspaceId = suite.snapshot?.workspace.id, token = suite.session?.tokens.accessToken;
    const load = async () => { if (!apiUrl)
        return; setError(undefined); setData(await suiteRequest(apiUrl, `/tools/${tool}/admin`)); if (active === "audit")
        setActivity(await suiteRequest(apiUrl, `/tools/${tool}/admin/audit`)); };
    useEffect(() => {
        let cancelled = false;
        setData(undefined);
        setError(undefined);
        setSaved(false);
        if (apiUrl && token && workspaceId) {
            suiteRequest(apiUrl, `/tools/${tool}/admin`).then(value => { if (!cancelled)
                setData(value); }, failure => { if (!cancelled)
                setError(failure); });
            if (active === "audit")
                suiteRequest(apiUrl, `/tools/${tool}/admin/audit`).then(value => { if (!cancelled)
                    setActivity(value); }, failure => { if (!cancelled)
                    setError(failure); });
        }
        return () => { cancelled = true; };
    }, [apiUrl, token, workspaceId, tool, active]);
    const change = async (path, body) => { setBusy(true); setError(undefined); setSaved(false); try {
        await suite.mutate(path, "PATCH", body);
        await load();
        setSaved(true);
    }
    catch (failure) {
        setError(failure);
        throw failure;
    }
    finally {
        setBusy(false);
    } };
    const exportData = async () => { setBusy(true); setError(undefined); try {
        const value = await suite.request(`/tools/${tool}/export`), url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })), anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${workspaceId}-${tool}.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setSaved(true);
    }
    catch (failure) {
        setError(failure);
    }
    finally {
        setBusy(false);
    } };
    if (error && !data)
        return error instanceof SuiteRequestError && [401, 403].includes(error.status) ? _jsx(NoPermissionState, { title: t("denied"), action: _jsx(Link, { href: suite.sosUrl || "/", children: t("home") }) }) : _jsx(ErrorState, { onRetry: () => void load().catch(setError) });
    if (!data)
        return _jsx(LoadingState, { rows: 4 });
    const readOnly = !data.canWrite, members = data.members.filter(member => member.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    return _jsx(ToolAdminLayout, { tool: tool, active: active, basePath: basePath, allow: true, children: _jsxs("div", { className: "flex min-w-0 flex-col gap-5", children: [readOnly ? _jsx("p", { role: "status", className: "rounded-field bg-sunken p-3 text-body-sm text-fg-muted", children: suite.snapshot?.actor.readOnly ? t("preview") : t("readonly") }) : null, error ? _jsx(ErrorState, { size: "compact", onRetry: () => void load().catch(setError) }) : null, saved ? _jsx("p", { role: "status", className: "text-body-sm text-success", children: t("saved") }) : null, active === "overview" || active === "billing" ? _jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Stat, { label: t("plan"), value: data.plan?.name || "—" }), _jsx(Stat, { label: t("seats"), value: `${f.number(data.seats.assigned)}${data.seats.capacity === null ? "" : ` / ${f.number(data.seats.capacity)}`}` })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: t("usage") }), Object.entries(data.plan?.usage || {}).map(([key, value]) => _jsxs("div", { className: "flex flex-wrap justify-between gap-3 border-b border-line py-3 last:border-0", children: [_jsx("span", { className: "text-body-sm text-fg-muted", children: suiteMetricLabel(locale, key) }), _jsxs("span", { className: "font-mono text-body-sm", children: [f.number(value), data.plan?.limits[key] !== undefined ? ` / ${f.number(data.plan.limits[key])}` : ""] })] }, key))] }), suite.isOwner ? _jsx(Button, { onClick: () => window.location.assign(`${suite.sosUrl || ""}/billing`), children: t("billing") }) : null] }) : null, active === "members" || active === "roles" ? _jsxs(_Fragment, { children: [_jsx(Toolbar, { label: t("members"), search: { value: query, onChange: setQuery, label: t("searchPeople") } }), members.length ? _jsx("div", { className: "divide-y divide-line rounded-card border border-line bg-raised", children: members.map(member => _jsxs("div", { className: "flex flex-wrap items-center gap-3 p-4", children: [_jsx("p", { dir: "auto", className: "min-w-0 flex-1 text-body-sm font-semibold", children: member.name }), member.assigned ? _jsxs(_Fragment, { children: [_jsx(Select, { size: "sm", "aria-label": `${t("role")} · ${member.name}`, value: member.roles[0], options: (member.allowedRoles || data.roles).map(role => ({ value: role, label: role.replaceAll("_", " ") })), disabled: readOnly || busy || !member.userId, onValueChange: role => { if (role)
                                                    void change(`/tools/${tool}/admin/members/${member.userId}`, { roles: [role] }).catch(() => { }); } }), _jsx(ConfirmDialog, { trigger: _jsx(Button, { variant: "ghost", size: "sm", disabled: readOnly || busy || member.userId === suite.session?.user.id, children: t("removeAccess") }), title: `${t("removeAccess")} · ${member.name}`, impact: SUITE_TOOLS[tool].labels[locale], confirmLabel: t("removeAccess"), onConfirm: () => change(`/tools/${tool}/admin/members/${member.userId}`, { assigned: false }) })] }) : _jsx(Button, { size: "sm", shape: "control", disabled: readOnly || busy || !member.userId || !member.allowedRoles.length || data.seats.available === 0, onClick: () => void change(`/tools/${tool}/admin/members/${member.userId}`, { assigned: true, roles: [member.allowedRoles.find(role => !["super_admin", "admin", "owner", "project_manager", "manager", "hr", "marketing_manager"].includes(role)) || member.allowedRoles[0]] }).catch(() => { }), children: t("assign") })] }, member.id)) }) : _jsx(EmptyState, { title: t("noPeople"), action: _jsx(Button, { variant: "ghost", onClick: () => setQuery(""), children: t("members") }) })] }) : null, active === "settings" ? _jsxs(Card, { children: [_jsx(CardHeader, { title: t("settings") }), _jsxs("div", { className: "mt-4 flex flex-col gap-5", children: [_jsx(InlineEdit, { value: data.settings.name || SUITE_TOOLS[tool].labels[locale], label: t("name"), disabled: readOnly, onSave: name => change(`/tools/${tool}/admin/settings`, { ...data.settings, name }) }), _jsx(InlineEdit, { value: data.settings.description || "", label: t("description"), disabled: readOnly, onSave: description => change(`/tools/${tool}/admin/settings`, { ...data.settings, description }) }), children] })] }) : null, active === "connections" ? _jsx("div", { className: "flex flex-col gap-3", children: data.connectors.map(connector => _jsxs(Card, { children: [_jsx(CardHeader, { title: `${SUITE_TOOLS[connector.source].labels[locale]} · ${SUITE_TOOLS[connector.target].labels[locale]}` }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center justify-between gap-4", children: [_jsx("p", { className: "text-body-sm text-fg-muted", children: connector.data?.join(" · ") }), _jsx(Checkbox, { label: t("enabled"), checked: connector.enabled, disabled: readOnly || busy || !suite.canAdmin(connector.source) && !["owner", "admin"].includes(suite.snapshot?.member.role || ""), onCheckedChange: enabled => void change(`/connectors/${connector.id}`, { enabled: Boolean(enabled) }).catch(() => { }) })] })] }, connector.id)) }) : null, active === "import-export" ? _jsxs(Card, { children: [_jsx(CardHeader, { title: t("importExport") }), _jsxs("div", { className: "mt-4 flex flex-col items-start gap-4", children: [_jsx(Button, { loading: busy, onClick: () => void exportData(), children: t("exportData") }), children] })] }) : null, active === "audit" ? activity.length ? _jsx(ActivityTimeline, { items: activity, label: t("audit") }) : _jsx(EmptyState, { title: t("noActivity"), action: _jsx(Button, { variant: "ghost", onClick: () => void load().catch(setError), children: t("audit") }) }) : null] }) });
}
//# sourceMappingURL=ToolAdminScreen.js.map