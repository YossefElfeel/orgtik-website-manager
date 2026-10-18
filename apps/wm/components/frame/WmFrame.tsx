"use client";
import { demoRuntime } from "@orgtik/ui";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppWindow, ArrowsSplit, GearSix, ListChecks, Translate, Tray, Article, ArrowSquareOut, Briefcase, Browsers, Globe, Heartbeat, Images, Key, Lightbulb, MagnifyingGlass, MapTrifold, Scales, SquaresFour, Stack, Tag, TextAa, Monitor } from "@phosphor-icons/react";
import {
  AppRail,
  Button,
  ErrorState,
  NoPermissionState,
  Sidebar,
  Spinner,
  SuiteShell,
  Toaster,
  UserMenu,
  type Locale,
  type SidebarSection,
} from "@orgtik/ui";
import { routing, usePathname, useRouter } from "@/i18n/routing";
import { SOS_URL, WEBSITE_URL } from "@/lib/env";
import { clearToken, getToken, signOutStaff } from "@/lib/session";
import { useClientSession } from "@orgtik/ui/auth";
import { statusOf, useMeQuery } from "@/store/api";
import { CURRENT_SCOPE, useSuiteApps } from "@/components/suite/useSuiteApps";
import { CenteredState } from "./CenteredState";

type NavItem = { key: string; href: string; icon: ReactNode; permission: string };
type NavSection = { label?: string; items: NavItem[] };

// The information architecture grows slice by slice (plan, Phase 2). Only built areas are listed,
// so no item leads to an empty "coming soon" page, and each one hides if the role can't view it.
function useNav(): NavSection[] {
  const t = useTranslations("Nav");
  const ti = useTranslations("Improvements");
  const studioText = useTranslations("Studio");
  return [
    ...(process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEMO_PANEL === "1" ? [{ items: [{ key: studioText("heading"), href: "/presentation", icon: <Monitor />, permission: "overview:view" }] }] : []),
    { items: [{ key: t("overview"), href: "/", icon: <SquaresFour />, permission: "overview:view" }] },
    {
      label: t("sections.website"),
      items: [
        { key: t("pages"), href: "/content/pages", icon: <Browsers />, permission: "content:view" },
        { key: t("global"), href: "/content/global", icon: <Globe />, permission: "content:view" },
        { key: t("strings"), href: "/content/strings", icon: <TextAa />, permission: "content:view" },
        { key: t("translations"), href: "/localization", icon: <Translate />, permission: "localization:view" },
        { key: t("preview"), href: "/preview", icon: <Monitor />, permission: "content:view" },
      ],
    },
    {
      label: t("sections.content"),
      items: [
        { key: t("services"), href: "/content/services", icon: <Stack />, permission: "content:view" },
        { key: t("software"), href: "/content/software", icon: <AppWindow />, permission: "content:view" },
        { key: t("work"), href: "/content/work", icon: <Briefcase />, permission: "content:view" },
        { key: ti("reviews"), href: "/content/reviews", icon: <Heartbeat />, permission: "content:view" },
        { key: t("insights"), href: "/content/insights", icon: <Article />, permission: "content:view" },
        { key: t("legal"), href: "/content/legal", icon: <Scales />, permission: "content:view" },
        { key: t("pricing"), href: "/content/pricing", icon: <Tag />, permission: "content:view" },
      ],
    },
    { label: t("sections.media"), items: [{ key: t("library"), href: "/media", icon: <Images />, permission: "media:view" }] },
    {
      label: t("sections.seo"),
      items: [
        { key: t("seoHealth"), href: "/seo", icon: <Heartbeat />, permission: "seo:view" },
        { key: t("redirects"), href: "/seo/redirects", icon: <ArrowsSplit />, permission: "seo:view" },
        { key: t("indexing"), href: "/seo/indexing", icon: <MagnifyingGlass />, permission: "seo:view" },
      ],
    },
    {
      label: t("sections.marketing"),
      items: [
        { key: t("roadmap"), href: "/content/roadmap", icon: <MapTrifold />, permission: "content:view" },
        { key: t("leads"), href: "/marketing/leads", icon: <Tray />, permission: "marketing:view" },
        { key: t("ideas"), href: "/marketing/ideas", icon: <Lightbulb />, permission: "marketing:view" },
      ],
    },
    {
      label: t("sections.settings"),
      items: [
        { key: t("site"), href: "/settings/site", icon: <GearSix />, permission: "settings:view" },
        { key: t("team"), href: "/settings/roles", icon: <Key />, permission: "settings:view" },
        { key: ti("userManagement"), href: "/settings/users", icon: <Key />, permission: "users:view" },
        { key: t("audit"), href: "/settings/audit", icon: <ListChecks />, permission: "settings:view" },
      ],
    },
  ];
}

/**
 * The Website Manager's frame. It asks the API who the person is on every load (/v2/admin/me)
 * and shows the state that answer calls for: signing in, signed out, no access, offline, or the
 * shell with the navigation that person's role may see.
 */
export function WmFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("App");
  const ta = useTranslations("Auth");
  const tn = useTranslations("NoAccess");
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const session = useClientSession();
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [token, setTokenState] = useState<string | null | undefined>(undefined);
  useEffect(() => setTokenState(getToken()), [session]);
  useEffect(() => {
    if (token === null) router.replace("/signed-out");
  }, [token, router]);

  const me = useMeQuery(undefined, { skip: !token });
  const apps = useSuiteApps(token ?? null);
  const nav = useNav();

  useEffect(() => {
    if (statusOf(me.error) === 401) {
      clearToken();
      router.replace("/signed-out");
    }
  }, [me.error, router]);

  if (token === undefined || token === null || me.isLoading || statusOf(me.error) === 401) {
    return (
      <CenteredState>
        <div className="flex justify-center py-6">
          <Spinner label={ta("checking")} />
        </div>
      </CenteredState>
    );
  }
  if (statusOf(me.error) === 403) {
    return (
      <CenteredState>
        <NoPermissionState size="compact" title={tn("title")} description={tn("body")} action={<Button variant="secondary" onClick={() => window.location.assign(SOS_URL)}>{tn("back")}</Button>} />
      </CenteredState>
    );
  }
  if (me.error || !me.data) {
    return (
      <CenteredState>
        <ErrorState size="compact" title={ta("offlineTitle")} description={ta("offlineBody")} onRetry={() => me.refetch()} />
      </CenteredState>
    );
  }

  const { user, permissions } = me.data;
  // The staff-session gate and /admin/me already check current membership. Keep navigation
  // aligned with current API permissions when roles have changed since this tab signed in.
  const allowed = new Set(permissions);
  const matches = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  // Only the most specific item is current: on /seo/redirects that's Redirects, not SEO health.
  const best = nav.flatMap((x) => x.items.map((i) => i.href)).filter(matches).sort((x, y) => y.length - x.length)[0];
  const at = (href: string) => href === best;
  const sections: SidebarSection[] = nav
    .map((s) => ({
      label: s.label,
      items: s.items.filter((i) => allowed.has(i.permission)).map((i) => ({ label: i.key, href: `/${locale}${i.href === "/" ? "" : i.href}`, icon: i.icon, active: at(i.href) })),
    }))
    .filter((s) => s.items.length);

  return (
    <SuiteShell
      demo={{ runtime: demoRuntime(process.env.NEXT_PUBLIC_DEMO_API, process.env.NEXT_PUBLIC_DEMO_WEB_URLS, process.env.NEXT_PUBLIC_DEMO_SOS_API), enabled: process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEMO_PANEL === "1", appKey: "wm", onLocaleChange: (next) => router.replace(pathname, { locale: next }) }}
      rail={<AppRail apps={apps} current={CURRENT_SCOPE} homeHref={SOS_URL} />}
      sidebar={<Sidebar title={t("name")} sections={sections} />}
      topBar={{
        start: (
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-body-sm font-semibold text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
          >
            <span dir="ltr">{t("site")}</span>
            <ArrowSquareOut aria-hidden="true" className="size-4 rtl:-scale-x-100" />
            <span className="sr-only">{t("viewSite")}</span>
          </a>
        ),
        end: (
          <UserMenu
            name={`${user.firstName} ${user.lastName}`}
            email={user.email}
            avatarSrc={user.avatar ?? undefined}
            locales={routing.locales as readonly Locale[]}
            onLocaleChange={(next) => router.replace(pathname, { locale: next })}
            onSignOut={() => {
              void signOutStaff().then(() => window.location.assign(SOS_URL)).catch(() => setSignOutFailed(true));
            }}
          />
        ),
      }}
    >
      <div className="mx-auto w-full max-w-6xl p-4 md:p-8">{children}</div>
      {signOutFailed && <ErrorState size="compact" title={ta("offlineTitle")} description={ta("offlineBody")} onRetry={() => { setSignOutFailed(false); void signOutStaff().then(() => window.location.assign(SOS_URL)).catch(() => setSignOutFailed(true)); }} />}
      <Toaster />
    </SuiteShell>
  );
}
