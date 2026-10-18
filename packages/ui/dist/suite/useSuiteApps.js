"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { House, CheckSquareOffset, Folder, UsersThree, ChartLineUp, Megaphone, ChatsCircle, Plus, GearSix, Browser } from "@phosphor-icons/react";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { useSuite } from "./useSuite.js";
import { SUITE_TOOLS } from "./registry.js";
import { suiteText } from "./strings.js";
import { staffToolLaunch } from "../auth/access.js";
export const SUITE_ICONS = { tasks: _jsx(CheckSquareOffset, {}), files: _jsx(Folder, {}), hr: _jsx(UsersThree, {}), crm: _jsx(ChartLineUp, {}), marketing: _jsx(Megaphone, {}), chat: _jsx(ChatsCircle, {}) };
export function useSuiteApps({ currentScope, currentHref, sosUrl, onNavigate }) {
    const suite = useSuite(), { locale } = useOrgtik();
    const launch = staffToolLaunch(suite.session);
    const tools = launch?.tools.filter(tool => tool in SUITE_TOOLS) || suite.accessibleTools;
    const workspaceId = suite.session?.workspaceContext?.workspace.id || launch?.workspaceId;
    const root = sosUrl.replace(/\/$/, ""), apps = [];
    const item = (id, label, href, icon) => ({ id, label, href, icon, ...(onNavigate && id !== currentScope ? { onNavigate: () => onNavigate(href) } : {}) });
    if (tools.length >= 2)
        apps.push(item("global", suiteText(locale, "home"), root || "/", _jsx(House, {})));
    for (const tool of tools) {
        const definition = SUITE_TOOLS[tool];
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
        apps.push(item(definition.scope, definition.labels[locale], definition.scope === currentScope ? currentHref : `${root}/go/${definition.scope}${query}`, SUITE_ICONS[tool]));
    }
    for (const staff of suite.session?.staffAccess?.apps || [])
        apps.push(item(staff === "admin" ? "platform_admin" : "website_manager", staff === "admin" ? "OrgTik Console" : "Website Manager", `${root}/go/${staff === "admin" ? "platform_admin" : "website_manager"}`, staff === "admin" ? _jsx(GearSix, {}) : _jsx(Browser, {})));
    if (suite.isOwner)
        apps.push(item("add_tool", suiteText(locale, "addTool"), `${root}/tools`, _jsx(Plus, {})));
    return apps;
}
//# sourceMappingURL=useSuiteApps.js.map