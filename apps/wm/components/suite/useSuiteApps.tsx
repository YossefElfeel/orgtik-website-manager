"use client";
import { Browser, ChartLineUp, ChatsCircle, CheckSquareOffset, Folder, House, Megaphone, ShieldCheck, UsersThree } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { staffToolLaunch, TOOL_SCOPES, useClientSession } from "@orgtik/ui/auth";
import type { RailApp } from "@orgtik/ui";
import { SOS_URL } from "@/lib/env";
export const CURRENT_SCOPE = "website_manager";
export function useSuiteApps(_token: string | null): RailApp[] {
  const session = useClientSession(), t = useTranslations("Suite"), locale = useLocale();
  const apps = session?.staffAccess?.apps || [];
  const launch = staffToolLaunch(session);
  const icons = { tasks: <CheckSquareOffset />, files: <Folder />, hr: <UsersThree />, crm: <ChartLineUp />, marketing: <Megaphone />, chat: <ChatsCircle /> };
  return [{ id: "global", label: t("global"), href: SOS_URL, icon: <House /> }, ...(launch?.tools || []).map(tool => ({
    id: TOOL_SCOPES[tool], label: t(TOOL_SCOPES[tool]), href: "/" + locale + "/go/" + tool, icon: icons[tool],
  })), ...apps.map(target => ({
    id: target === "admin" ? "platform_admin" : "website_manager",
    label: t(target === "admin" ? "platform_admin" : "website_manager"),
    href: target === "wm" ? "/" + locale : "/" + locale + "/go/" + target,
    icon: target === "admin" ? <ShieldCheck /> : <Browser />,
  }))];
}
