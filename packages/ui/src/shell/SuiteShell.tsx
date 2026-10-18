"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { List, Moon, SignOut, Sun, Translate } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { scrim } from "../lib/overlay.js";
import { LOCALES, type Locale } from "../locale.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
import { useTheme } from "../theme/theme.js";
import { Avatar } from "../components/Display.js";
import { Menu, MenuContent, MenuGroup, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "../components/Menu.js";
import { Logo } from "./Logo.js";
import { DemoProvider, DemoPanel, DemoSceneBanner, DemoStateView, type DemoOptions } from "../demo/DemoPanel.js";
import { SuiteConnections } from "../demo/SuiteConnections.js";

// The rail (suite apps) and sidebar (this app's pages) sit at the reading start: on the left in
// LTR, on the right in RTL. Both are plain CSS grid columns, so they follow `dir` by themselves.

export type RailApp = { id: string; label: string; href: string; icon: ReactNode; badge?: ReactNode; onNavigate?: () => void };

export function AppRail({ apps, current, homeHref = "/" }: { apps: RailApp[]; current?: string; homeHref?: string }) {
  const t = useStrings();
  const { Link } = useOrgtik();
  return (
    <nav aria-label={t("apps")} className="flex h-full min-h-0 w-[76px] flex-col items-center gap-1 overflow-y-auto bg-chrome py-3 text-fg-on-chrome [&>a]:shrink-0">
      <Link href={homeHref} className="mb-3 grid size-11 place-items-center rounded-field focus-visible:outline-2 focus-visible:outline-focus">
        <Logo variant="mark" tone="brand" className="h-8" />
      </Link>
      {apps.filter(app => !["website_manager_legacy", "content"].includes(app.id)).map((app) => {
        const active = app.id === current;
        return (
          <Link
            key={app.id}
            href={app.href}
            onClick={app.onNavigate ? event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) { event.preventDefault(); app.onNavigate?.(); } } : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex w-[64px] flex-col items-center gap-1 rounded-field px-1 py-2 text-micro text-fg-on-chrome-muted transition-colors",
              "hover:bg-[color-mix(in_oklab,var(--ot-fg-on-chrome)_8%,transparent)] hover:text-fg-on-chrome",
              "focus-visible:outline-2 focus-visible:outline-focus aria-[current=page]:text-fg-on-chrome",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-9 place-items-center rounded-field text-[20px] transition-colors",
                active && "bg-[color-mix(in_oklab,var(--ot-fg-on-chrome)_14%,transparent)]",
              )}
            >
              {app.icon}
            </span>
            <span className="w-full truncate text-center">{app.label}</span>
            {app.badge ? <span className="absolute end-2 top-1.5">{app.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export type SidebarItem = { label: string; href: string; icon?: ReactNode; active?: boolean; count?: number };
export type SidebarSection = { label?: string; items: SidebarItem[] };

export function Sidebar({ title, sections, footer }: { title: ReactNode; sections: SidebarSection[]; footer?: ReactNode }) {
  const t = useStrings();
  const { Link } = useOrgtik();
  return (
    <nav aria-label={t("mainNavigation")} className="flex h-full w-full flex-col gap-4 overflow-y-auto border-e border-line bg-raised px-3 py-4">
      <div data-sidebar-label className="px-2 font-display text-title-sm text-fg">{title}</div>
      {sections.map((section, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {section.label ? <div data-sidebar-label className="px-2 pb-1 text-caption font-semibold text-fg-subtle">{section.label}</div> : null}
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex h-control-md items-center gap-2.5 rounded-field px-2.5 text-body text-fg-muted transition-colors hover:bg-hover hover:text-fg",
                "focus-visible:outline-2 focus-visible:outline-focus aria-[current=page]:bg-brand-subtle aria-[current=page]:font-semibold aria-[current=page]:text-fg-brand",
              )}
            >
              {item.icon ? <span aria-hidden="true" className="grid size-5 place-items-center text-[18px]">{item.icon}</span> : null}
              {/* dir=auto: a label can be user content (a pinned folder named in Latin in an Arabic page). */}
              <span data-sidebar-label dir="auto" className="flex-1 truncate text-start">{item.label}</span>
              {item.count !== undefined ? <span data-sidebar-label className="text-caption tabular-nums text-fg-subtle">{item.count}</span> : null}
            </Link>
          ))}
        </div>
      ))}
      {footer ? <div className="mt-auto">{footer}</div> : null}
    </nav>
  );
}

const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", de: "Deutsch", fr: "Français", it: "Italiano" };

/** The person's menu: who they are, theme, language, sign out. */
export function UserMenu({
  name,
  email,
  avatarSrc,
  locales = LOCALES,
  onLocaleChange,
  onSignOut,
  children,
}: {
  name: string;
  email?: string;
  avatarSrc?: string;
  locales?: readonly Locale[];
  onLocaleChange?: (locale: Locale) => void;
  onSignOut: () => void;
  /** Extra items, e.g. "Profile" and "Workspace settings". */
  children?: ReactNode;
}) {
  const t = useStrings();
  const { locale } = useOrgtik();
  const [theme, setTheme] = useTheme();
  return (
    <Menu>
      <MenuTrigger
        aria-label={t("account")}
        className="rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Avatar name={name} src={avatarSrc} size="sm" decorative />
      </MenuTrigger>
      <MenuContent align="end" className="min-w-60">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar name={name} src={avatarSrc} size="md" decorative />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body font-semibold text-fg">{name}</span>
            {email ? <span dir="ltr" className="truncate text-start text-caption text-fg-muted">{email}</span> : null}
          </div>
        </div>
        <MenuSeparator />
        {children ? (
          <>
            {children}
            <MenuSeparator />
          </>
        ) : null}
        <MenuGroup label={t("theme")}>
          <MenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as "light" | "dark")}>
            <MenuRadioItem value="light">
              <span className="inline-flex items-center gap-2"><Sun aria-hidden="true" className="size-4 text-fg-muted" />{t("themeLight")}</span>
            </MenuRadioItem>
            <MenuRadioItem value="dark">
              <span className="inline-flex items-center gap-2"><Moon aria-hidden="true" className="size-4 text-fg-muted" />{t("themeDark")}</span>
            </MenuRadioItem>
          </MenuRadioGroup>
        </MenuGroup>
        {onLocaleChange ? (
          <>
            <MenuSeparator />
            <MenuGroup label={t("language")}>
              <MenuRadioGroup value={locale} onValueChange={(v) => { window.dispatchEvent(new CustomEvent("orgtik:locale", { detail: v })); onLocaleChange(v as Locale); }}>
                {locales.map((l) => (
                  <MenuRadioItem key={l} value={l}>
                    <span lang={l} dir={l === "ar" ? "rtl" : "ltr"}>{LANGUAGE_NAMES[l]}</span>
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuGroup>
          </>
        ) : null}
        <MenuSeparator />
        <MenuItem icon={<SignOut className="rtl:-scale-x-100" />} onClick={onSignOut}>
          {t("signOut")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function TopBar({ start, end, onOpenNavigation }: { start?: ReactNode; end?: ReactNode; onOpenNavigation?: () => void }) {
  const t = useStrings();
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-raised px-4">
      {onOpenNavigation ? (
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label={t("openNavigation")}
          className="grid size-control-sm place-items-center rounded-pill text-fg hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus lg:hidden"
        >
          <List aria-hidden="true" className="size-5" />
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-3">{start}</div>
      <div className="flex shrink-0 items-center gap-2">{end}</div>
    </header>
  );
}

export type SuiteShellProps = {
  sidebarCollapsed?: boolean;
  demo?: DemoOptions;
  rail: ReactNode;
  sidebar: ReactNode;
  /** TopBar's contents: `start` (search, workspace switcher) and `end` (help, notifications, UserMenu). */
  topBar?: { start?: ReactNode; end?: ReactNode };
  /** <BannerRegion banners={…} />: sits above the page, below the top bar. */
  banner?: ReactNode;
  children: ReactNode;
};

/**
 * The suite's frame: rail + sidebar + top bar + banner slot + content. Under 1024px the rail
 * and sidebar move into a sheet opened from the top bar.
 */
export function SuiteShell(props: SuiteShellProps) {
  return <DemoProvider options={props.demo}><SuiteShellView {...props} /></DemoProvider>;
}

function SuiteShellView({ rail, sidebar, sidebarCollapsed = false, topBar, banner, children }: SuiteShellProps) {
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const [presentation, setPresentation] = useState(false);
  useEffect(() => { setPresentation(window.location.pathname.split("/").includes("presentation")); }, []);
  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-fg">
      <a
        href="#ot-main"
        className="fixed start-3 top-3 z-[70] -translate-y-20 rounded-pill bg-action-primary px-4 py-2 text-body font-semibold text-on-action-primary focus-visible:translate-y-0"
      >
        {t("skipToContent")}
      </a>
      <div className="hidden min-h-0 shrink-0 lg:flex">
        {rail}
        <div className={sidebarCollapsed ? "w-16" : "w-(--ot-layout-sidebar)"}>{sidebar}</div>
      </div>
      <BaseDialog.Root open={open} onOpenChange={setOpen}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className={cn(scrim, "lg:hidden")} />
          <BaseDialog.Popup
            aria-label={t("mainNavigation")}
            className={cn(
              "fixed inset-y-0 start-0 z-50 flex w-[min(100vw-3rem,324px)] shadow-overlay outline-none lg:hidden",
              "transition-transform duration-(--ot-duration-slow) ease-ot-out-strong",
              "data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full rtl:data-[starting-style]:translate-x-full rtl:data-[ending-style]:translate-x-full",
            )}
            onClick={(e) => {
              // A tap on a link navigates; close the sheet with it.
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            {rail}
            <div className="min-w-0 flex-1">{sidebar}</div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar start={topBar?.start} end={<>{topBar?.end}{presentation ? <SuiteConnections /> : null}<DemoPanel /></>} onOpenNavigation={() => setOpen(true)} />
        {banner}
        <DemoSceneBanner />
        {/* The page scrolls here, so the keyboard must be able to reach it even when it holds no
            links (axe scrollable-region-focusable): a tab stop with a visible ring, and the skip
            link's target. */}
        <main
          id="ot-main"
          tabIndex={0}
          className="relative min-h-0 min-w-0 flex-1 overflow-y-auto outline-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <DemoStateView>{children}</DemoStateView>
        </main>
      </div>
    </div>
  );
}
