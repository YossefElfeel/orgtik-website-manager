"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Gauge, UsersThree, ShieldCheck, GearSix, Plugs, ArrowsDownUp, ClockCounterClockwise, CreditCard } from "@phosphor-icons/react";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { NoPermissionState } from "../components/States.js";
import { useSuite } from "./useSuite.js";
import { SettingsLayout } from "./SettingsLayout.js";
import { SUITE_TOOLS } from "./registry.js";
import { suiteText } from "./strings.js";
const sections = [{ id: "overview", key: "overview", icon: _jsx(Gauge, {}) }, { id: "members", key: "members", icon: _jsx(UsersThree, {}) }, { id: "roles", key: "roles", icon: _jsx(ShieldCheck, {}) }, { id: "settings", key: "settings", icon: _jsx(GearSix, {}) }, { id: "connections", key: "connections", icon: _jsx(Plugs, {}) }, { id: "import-export", key: "importExport", icon: _jsx(ArrowsDownUp, {}) }, { id: "audit", key: "audit", icon: _jsx(ClockCounterClockwise, {}) }, { id: "billing", key: "billing", icon: _jsx(CreditCard, {}) }];
export function ToolAdminLayout({ tool, active, basePath, children, description, allow }) {
    const suite = useSuite(), { locale } = useOrgtik();
    if (!(allow ?? suite.canAdmin(tool)))
        return _jsx(NoPermissionState, { title: suiteText(locale, "denied") });
    return _jsx(SettingsLayout, { title: `${SUITE_TOOLS[tool].labels[locale]} · ${suiteText(locale, "administration")}`, description: description, active: active, sections: sections.map(section => ({ ...section, label: suiteText(locale, section.key), href: `${basePath}${section.id === "overview" ? "" : `/${section.id}`}` })), children: children });
}
//# sourceMappingURL=ToolAdminLayout.js.map