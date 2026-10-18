"use client";
import { useState, type ReactNode } from "react";
import { SidebarSimple } from "@phosphor-icons/react";
import { SuiteShell, AppRail, type SuiteShellProps } from "../shell/SuiteShell.js";
import { Breadcrumb, type Crumb } from "../components/Navigation.js";
import { IconButton } from "../components/IconButton.js";
import { CommandPalette } from "../components/CommandPalette.js";
import { NotificationCenter } from "../components/NotificationCenter.js";
import { BannerRegion, type Banner } from "../shell/BannerRegion.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { useSuite, SuiteProvider } from "./useSuite.js";
import { useSuiteApps } from "./useSuiteApps.js";
import { suiteText } from "./strings.js";
import { PreferenceSync } from "./PreferenceSync.js";
import type { SuiteOptions, SuiteSearchItem, SuiteNotification } from "./types.js";
export type SuiteFrameProps = Omit<SuiteShellProps, "rail" | "topBar" | "banner"> & SuiteOptions & { currentScope: string; currentHref?: string; userMenu?: ReactNode; breadcrumbs?: Crumb[]; banner?: ReactNode; width?: "narrow" | "default" | "wide" | "full"; onNavigate?: (href: string) => void; search?: { load: (query: string, signal: AbortSignal) => Promise<SuiteSearchItem[]>; onSelect: (item: SuiteSearchItem) => Promise<unknown> | void }; notifications?: { load: () => Promise<SuiteNotification[]>; onSelect: (item: SuiteNotification) => Promise<unknown> | void; onRead?: (id: string) => Promise<unknown>; onReadAll?: () => Promise<unknown> } };
export function SuiteFrame(props: SuiteFrameProps) { return <SuiteProvider snapshot={props.snapshot} apiUrl={props.apiUrl} sosUrl={props.sosUrl} currentTool={props.currentTool} loading={props.loading} error={props.error}><FrameView {...props} /></SuiteProvider>; }
function FrameView({ currentScope, currentHref = "/", sosUrl = "", sidebar, userMenu, breadcrumbs, children, demo, banner, width = "default", onNavigate, search, notifications }: SuiteFrameProps) {
  const suite = useSuite(), { locale, Link } = useOrgtik(), [collapsed, setCollapsed] = useState(false);
  const apps = useSuiteApps({ currentScope, currentHref, sosUrl, onNavigate });
  const select = (item: SuiteSearchItem) => {
    const tools = suite.snapshot?.tools;
    const tool = tools && item.tool in tools ? tools[item.tool as keyof typeof tools] : null;
    const href = item.tool === "account" ? `${sosUrl}${item.path}` : tool ? `${sosUrl}/go/${tool.scope}?redirect=${encodeURIComponent(item.path)}` : `${sosUrl}${item.path}`;
    if (onNavigate) onNavigate(href); else window.location.assign(href);
  };
  const suiteSearch = search || (suite.apiUrl ? { load: (query: string, signal: AbortSignal) => import("./api.js").then(({ suiteRequest }) => suiteRequest<SuiteSearchItem[]>(suite.apiUrl!, `/search?q=${encodeURIComponent(query)}`, { signal })), onSelect: select } : undefined);
  const suiteNotifications = notifications || (suite.apiUrl ? { load: () => suite.request<SuiteNotification[]>("/notifications"), onSelect: select, onRead: (id: string) => suite.request("/notifications/read", "POST", { ids: [id] }), onReadAll: () => suite.request("/notifications/read", "POST", { all: true }) } : undefined);
  const banners: Banner[] = [];
  if (suite.snapshot?.actor.readOnly) banners.push({ kind: "staff_viewing", title: suiteText(locale, "preview") });
  else if (suite.snapshot?.workspace.state === "suspended" || suite.currentTool && suite.toolState(suite.currentTool)?.access === "read_only") banners.push({ kind: "read_only", title: suiteText(locale, "readonly"), description: suiteText(locale, "readonlyBody"), action: suite.isOwner ? <Link href={`${sosUrl}/billing`} className="font-semibold underline">{suiteText(locale, "billing")}</Link> : undefined });
  const widths = { narrow: "max-w-(--ot-layout-narrow)", default: "max-w-(--ot-layout-default)", wide: "max-w-(--ot-layout-wide)", full: "max-w-none" };
  const side = <div data-collapsed={collapsed} className="ot-suite-sidebar flex h-full min-h-0 flex-col"><div className="flex items-center gap-2 border-b border-line bg-raised px-3 py-2"><span data-sidebar-label dir="auto" className="min-w-0 flex-1 truncate text-caption text-fg-muted">{suite.snapshot?.workspace.name}</span><IconButton label={suiteText(locale, collapsed ? "expandNavigation" : "collapseNavigation")} size="xs" icon={<SidebarSimple />} onClick={() => setCollapsed(value => !value)} className="hidden lg:grid" /></div><div className="min-h-0 flex-1">{sidebar}</div></div>;
  return <SuiteShell demo={demo} sidebarCollapsed={collapsed} rail={<AppRail apps={apps} current={currentScope} homeHref={suite.accessibleTools.length >= 2 ? sosUrl || "/" : currentHref} />} sidebar={side} banner={<><PreferenceSync />{banners.length ? <BannerRegion banners={banners} /> : null}{banner}</>} topBar={{ start: <Breadcrumb items={breadcrumbs || [{ label: apps.find(app => app.id === currentScope)?.label || "OrgTik" }, ...(suite.snapshot ? [{ label: suite.snapshot.workspace.name }] : [])]} />, end: <>{suiteSearch ? <CommandPalette key={`search:${suite.snapshot?.workspace.id}:${suite.snapshot?.actor.effectiveUserId}`} {...suiteSearch} /> : null}{suiteNotifications ? <NotificationCenter key={`notifications:${suite.snapshot?.workspace.id}:${suite.snapshot?.actor.effectiveUserId}`} {...suiteNotifications} /> : null}{userMenu}</> }}><div data-density={suite.snapshot?.preferences?.density || "comfortable"} className={`mx-auto min-w-0 w-full p-4 font-body sm:p-6 ${widths[width]}`}>{children}</div></SuiteShell>;
}
