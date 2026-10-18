"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { SidebarSimple } from "@phosphor-icons/react";
import { SuiteShell, AppRail } from "../shell/SuiteShell.js";
import { Breadcrumb } from "../components/Navigation.js";
import { IconButton } from "../components/IconButton.js";
import { CommandPalette } from "../components/CommandPalette.js";
import { NotificationCenter } from "../components/NotificationCenter.js";
import { BannerRegion } from "../shell/BannerRegion.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { useSuite, SuiteProvider } from "./useSuite.js";
import { useSuiteApps } from "./useSuiteApps.js";
import { suiteText } from "./strings.js";
import { PreferenceSync } from "./PreferenceSync.js";
export function SuiteFrame(props) { return _jsx(SuiteProvider, { snapshot: props.snapshot, apiUrl: props.apiUrl, sosUrl: props.sosUrl, currentTool: props.currentTool, loading: props.loading, error: props.error, children: _jsx(FrameView, { ...props }) }); }
function FrameView({ currentScope, currentHref = "/", sosUrl = "", sidebar, userMenu, breadcrumbs, children, demo, banner, width = "default", onNavigate, search, notifications }) {
    const suite = useSuite(), { locale, Link } = useOrgtik(), [collapsed, setCollapsed] = useState(false);
    const apps = useSuiteApps({ currentScope, currentHref, sosUrl, onNavigate });
    const select = (item) => {
        const tools = suite.snapshot?.tools;
        const tool = tools && item.tool in tools ? tools[item.tool] : null;
        const href = item.tool === "account" ? `${sosUrl}${item.path}` : tool ? `${sosUrl}/go/${tool.scope}?redirect=${encodeURIComponent(item.path)}` : `${sosUrl}${item.path}`;
        if (onNavigate)
            onNavigate(href);
        else
            window.location.assign(href);
    };
    const suiteSearch = search || (suite.apiUrl ? { load: (query, signal) => import("./api.js").then(({ suiteRequest }) => suiteRequest(suite.apiUrl, `/search?q=${encodeURIComponent(query)}`, { signal })), onSelect: select } : undefined);
    const suiteNotifications = notifications || (suite.apiUrl ? { load: () => suite.request("/notifications"), onSelect: select, onRead: (id) => suite.request("/notifications/read", "POST", { ids: [id] }), onReadAll: () => suite.request("/notifications/read", "POST", { all: true }) } : undefined);
    const banners = [];
    if (suite.snapshot?.actor.readOnly)
        banners.push({ kind: "staff_viewing", title: suiteText(locale, "preview") });
    else if (suite.snapshot?.workspace.state === "suspended" || suite.currentTool && suite.toolState(suite.currentTool)?.access === "read_only")
        banners.push({ kind: "read_only", title: suiteText(locale, "readonly"), description: suiteText(locale, "readonlyBody"), action: suite.isOwner ? _jsx(Link, { href: `${sosUrl}/billing`, className: "font-semibold underline", children: suiteText(locale, "billing") }) : undefined });
    const widths = { narrow: "max-w-(--ot-layout-narrow)", default: "max-w-(--ot-layout-default)", wide: "max-w-(--ot-layout-wide)", full: "max-w-none" };
    const side = _jsxs("div", { "data-collapsed": collapsed, className: "ot-suite-sidebar flex h-full min-h-0 flex-col", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-line bg-raised px-3 py-2", children: [_jsx("span", { "data-sidebar-label": true, dir: "auto", className: "min-w-0 flex-1 truncate text-caption text-fg-muted", children: suite.snapshot?.workspace.name }), _jsx(IconButton, { label: suiteText(locale, collapsed ? "expandNavigation" : "collapseNavigation"), size: "xs", icon: _jsx(SidebarSimple, {}), onClick: () => setCollapsed(value => !value), className: "hidden lg:grid" })] }), _jsx("div", { className: "min-h-0 flex-1", children: sidebar })] });
    return _jsx(SuiteShell, { demo: demo, sidebarCollapsed: collapsed, rail: _jsx(AppRail, { apps: apps, current: currentScope, homeHref: suite.accessibleTools.length >= 2 ? sosUrl || "/" : currentHref }), sidebar: side, banner: _jsxs(_Fragment, { children: [_jsx(PreferenceSync, {}), banners.length ? _jsx(BannerRegion, { banners: banners }) : null, banner] }), topBar: { start: _jsx(Breadcrumb, { items: breadcrumbs || [{ label: apps.find(app => app.id === currentScope)?.label || "OrgTik" }, ...(suite.snapshot ? [{ label: suite.snapshot.workspace.name }] : [])] }), end: _jsxs(_Fragment, { children: [suiteSearch ? _jsx(CommandPalette, { ...suiteSearch }, `search:${suite.snapshot?.workspace.id}:${suite.snapshot?.actor.effectiveUserId}`) : null, suiteNotifications ? _jsx(NotificationCenter, { ...suiteNotifications }, `notifications:${suite.snapshot?.workspace.id}:${suite.snapshot?.actor.effectiveUserId}`) : null, userMenu] }) }, children: _jsx("div", { "data-density": suite.snapshot?.preferences?.density || "comfortable", className: `mx-auto min-w-0 w-full p-4 font-body sm:p-6 ${widths[width]}`, children: children }) });
}
//# sourceMappingURL=SuiteFrame.js.map