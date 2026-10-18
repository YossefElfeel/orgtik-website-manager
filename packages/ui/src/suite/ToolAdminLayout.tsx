"use client";
import type { ReactNode } from "react";
import { Gauge, UsersThree, ShieldCheck, GearSix, Plugs, ArrowsDownUp, ClockCounterClockwise, CreditCard } from "@phosphor-icons/react";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { NoPermissionState } from "../components/States.js";
import { useSuite } from "./useSuite.js";
import { SettingsLayout } from "./SettingsLayout.js";
import { SUITE_TOOLS } from "./registry.js";
import { suiteText, type SuiteString } from "./strings.js";
import type { ToolKey } from "./types.js";
export type ToolAdminSection = "overview" | "members" | "roles" | "settings" | "connections" | "import-export" | "audit" | "billing";
const sections: { id: ToolAdminSection; key: SuiteString; icon: ReactNode }[] = [{ id: "overview", key: "overview", icon: <Gauge /> }, { id: "members", key: "members", icon: <UsersThree /> }, { id: "roles", key: "roles", icon: <ShieldCheck /> }, { id: "settings", key: "settings", icon: <GearSix /> }, { id: "connections", key: "connections", icon: <Plugs /> }, { id: "import-export", key: "importExport", icon: <ArrowsDownUp /> }, { id: "audit", key: "audit", icon: <ClockCounterClockwise /> }, { id: "billing", key: "billing", icon: <CreditCard /> }];
export function ToolAdminLayout({ tool, active, basePath, children, description, allow }: { tool: ToolKey; active: ToolAdminSection; basePath: string; children: ReactNode; description?: string; allow?: boolean }) {
  const suite = useSuite(), { locale } = useOrgtik();
  if (!(allow ?? suite.canAdmin(tool))) return <NoPermissionState title={suiteText(locale, "denied")} />;
  return <SettingsLayout title={`${SUITE_TOOLS[tool].labels[locale]} · ${suiteText(locale, "administration")}`} description={description} active={active} sections={sections.map(section => ({ ...section, label: suiteText(locale, section.key), href: `${basePath}${section.id === "overview" ? "" : `/${section.id}`}` }))}>{children}</SettingsLayout>;
}
