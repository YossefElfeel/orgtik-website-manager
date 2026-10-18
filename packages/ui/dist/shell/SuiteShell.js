"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { List, Moon, SignOut, Sun, Translate } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { scrim } from "../lib/overlay.js";
import { LOCALES } from "../locale.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
import { useTheme } from "../theme/theme.js";
import { Avatar } from "../components/Display.js";
import { Menu, MenuContent, MenuGroup, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "../components/Menu.js";
import { Logo } from "./Logo.js";
import { DemoProvider, DemoPanel, DemoSceneBanner, DemoStateView } from "../demo/DemoPanel.js";
import { SuiteConnections } from "../demo/SuiteConnections.js";
export function AppRail({ apps, current, homeHref = "/" }) {
    const t = useStrings();
    const { Link } = useOrgtik();
    return (_jsxs("nav", { "aria-label": t("apps"), className: "flex h-full min-h-0 w-[76px] flex-col items-center gap-1 overflow-y-auto bg-chrome py-3 text-fg-on-chrome [&>a]:shrink-0", children: [_jsx(Link, { href: homeHref, className: "mb-3 grid size-11 place-items-center rounded-field focus-visible:outline-2 focus-visible:outline-focus", children: _jsx(Logo, { variant: "mark", tone: "brand", className: "h-8" }) }), apps.filter(app => !["website_manager_legacy", "content"].includes(app.id)).map((app) => {
                const active = app.id === current;
                return (_jsxs(Link, { href: app.href, onClick: app.onNavigate ? event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
                        event.preventDefault();
                        app.onNavigate?.();
                    } } : undefined, "aria-current": active ? "page" : undefined, className: cn("relative flex w-[64px] flex-col items-center gap-1 rounded-field px-1 py-2 text-micro text-fg-on-chrome-muted transition-colors", "hover:bg-[color-mix(in_oklab,var(--ot-fg-on-chrome)_8%,transparent)] hover:text-fg-on-chrome", "focus-visible:outline-2 focus-visible:outline-focus aria-[current=page]:text-fg-on-chrome"), children: [_jsx("span", { "aria-hidden": "true", className: cn("grid size-9 place-items-center rounded-field text-[20px] transition-colors", active && "bg-[color-mix(in_oklab,var(--ot-fg-on-chrome)_14%,transparent)]"), children: app.icon }), _jsx("span", { className: "w-full truncate text-center", children: app.label }), app.badge ? _jsx("span", { className: "absolute end-2 top-1.5", children: app.badge }) : null] }, app.id));
            })] }));
}
export function Sidebar({ title, sections, footer }) {
    const t = useStrings();
    const { Link } = useOrgtik();
    return (_jsxs("nav", { "aria-label": t("mainNavigation"), className: "flex h-full w-full flex-col gap-4 overflow-y-auto border-e border-line bg-raised px-3 py-4", children: [_jsx("div", { "data-sidebar-label": true, className: "px-2 font-display text-title-sm text-fg", children: title }), sections.map((section, i) => (_jsxs("div", { className: "flex flex-col gap-0.5", children: [section.label ? _jsx("div", { "data-sidebar-label": true, className: "px-2 pb-1 text-caption font-semibold text-fg-subtle", children: section.label }) : null, section.items.map((item) => (_jsxs(Link, { href: item.href, "aria-label": item.label, "aria-current": item.active ? "page" : undefined, className: cn("flex h-control-md items-center gap-2.5 rounded-field px-2.5 text-body text-fg-muted transition-colors hover:bg-hover hover:text-fg", "focus-visible:outline-2 focus-visible:outline-focus aria-[current=page]:bg-brand-subtle aria-[current=page]:font-semibold aria-[current=page]:text-fg-brand"), children: [item.icon ? _jsx("span", { "aria-hidden": "true", className: "grid size-5 place-items-center text-[18px]", children: item.icon }) : null, _jsx("span", { "data-sidebar-label": true, dir: "auto", className: "flex-1 truncate text-start", children: item.label }), item.count !== undefined ? _jsx("span", { "data-sidebar-label": true, className: "text-caption tabular-nums text-fg-subtle", children: item.count }) : null] }, item.href)))] }, i))), footer ? _jsx("div", { className: "mt-auto", children: footer }) : null] }));
}
const LANGUAGE_NAMES = { en: "English", ar: "العربية", de: "Deutsch", fr: "Français", it: "Italiano" };
/** The person's menu: who they are, theme, language, sign out. */
export function UserMenu({ name, email, avatarSrc, locales = LOCALES, onLocaleChange, onSignOut, children, }) {
    const t = useStrings();
    const { locale } = useOrgtik();
    const [theme, setTheme] = useTheme();
    return (_jsxs(Menu, { children: [_jsx(MenuTrigger, { "aria-label": t("account"), className: "rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", children: _jsx(Avatar, { name: name, src: avatarSrc, size: "sm", decorative: true }) }), _jsxs(MenuContent, { align: "end", className: "min-w-60", children: [_jsxs("div", { className: "flex items-center gap-3 px-2 py-2", children: [_jsx(Avatar, { name: name, src: avatarSrc, size: "md", decorative: true }), _jsxs("div", { className: "flex min-w-0 flex-col", children: [_jsx("span", { className: "truncate text-body font-semibold text-fg", children: name }), email ? _jsx("span", { dir: "ltr", className: "truncate text-start text-caption text-fg-muted", children: email }) : null] })] }), _jsx(MenuSeparator, {}), children ? (_jsxs(_Fragment, { children: [children, _jsx(MenuSeparator, {})] })) : null, _jsx(MenuGroup, { label: t("theme"), children: _jsxs(MenuRadioGroup, { value: theme, onValueChange: (v) => setTheme(v), children: [_jsx(MenuRadioItem, { value: "light", children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Sun, { "aria-hidden": "true", className: "size-4 text-fg-muted" }), t("themeLight")] }) }), _jsx(MenuRadioItem, { value: "dark", children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Moon, { "aria-hidden": "true", className: "size-4 text-fg-muted" }), t("themeDark")] }) })] }) }), onLocaleChange ? (_jsxs(_Fragment, { children: [_jsx(MenuSeparator, {}), _jsx(MenuGroup, { label: t("language"), children: _jsx(MenuRadioGroup, { value: locale, onValueChange: (v) => { window.dispatchEvent(new CustomEvent("orgtik:locale", { detail: v })); onLocaleChange(v); }, children: locales.map((l) => (_jsx(MenuRadioItem, { value: l, children: _jsx("span", { lang: l, dir: l === "ar" ? "rtl" : "ltr", children: LANGUAGE_NAMES[l] }) }, l))) }) })] })) : null, _jsx(MenuSeparator, {}), _jsx(MenuItem, { icon: _jsx(SignOut, { className: "rtl:-scale-x-100" }), onClick: onSignOut, children: t("signOut") })] })] }));
}
export function TopBar({ start, end, onOpenNavigation }) {
    const t = useStrings();
    return (_jsxs("header", { className: "flex h-14 shrink-0 items-center gap-3 border-b border-line bg-raised px-4", children: [onOpenNavigation ? (_jsx("button", { type: "button", onClick: onOpenNavigation, "aria-label": t("openNavigation"), className: "grid size-control-sm place-items-center rounded-pill text-fg hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus lg:hidden", children: _jsx(List, { "aria-hidden": "true", className: "size-5" }) })) : null, _jsx("div", { className: "flex min-w-0 flex-1 items-center gap-3", children: start }), _jsx("div", { className: "flex shrink-0 items-center gap-2", children: end })] }));
}
/**
 * The suite's frame: rail + sidebar + top bar + banner slot + content. Under 1024px the rail
 * and sidebar move into a sheet opened from the top bar.
 */
export function SuiteShell(props) {
    return _jsx(DemoProvider, { options: props.demo, children: _jsx(SuiteShellView, { ...props }) });
}
function SuiteShellView({ rail, sidebar, sidebarCollapsed = false, topBar, banner, children }) {
    const t = useStrings();
    const [open, setOpen] = useState(false);
    const [presentation, setPresentation] = useState(false);
    useEffect(() => { setPresentation(window.location.pathname.split("/").includes("presentation")); }, []);
    return (_jsxs("div", { className: "flex h-dvh overflow-hidden bg-canvas text-fg", children: [_jsx("a", { href: "#ot-main", className: "fixed start-3 top-3 z-[70] -translate-y-20 rounded-pill bg-action-primary px-4 py-2 text-body font-semibold text-on-action-primary focus-visible:translate-y-0", children: t("skipToContent") }), _jsxs("div", { className: "hidden min-h-0 shrink-0 lg:flex", children: [rail, _jsx("div", { className: sidebarCollapsed ? "w-16" : "w-(--ot-layout-sidebar)", children: sidebar })] }), _jsx(BaseDialog.Root, { open: open, onOpenChange: setOpen, children: _jsxs(BaseDialog.Portal, { children: [_jsx(BaseDialog.Backdrop, { className: cn(scrim, "lg:hidden") }), _jsxs(BaseDialog.Popup, { "aria-label": t("mainNavigation"), className: cn("fixed inset-y-0 start-0 z-50 flex w-[min(100vw-3rem,324px)] shadow-overlay outline-none lg:hidden", "transition-transform duration-(--ot-duration-slow) ease-ot-out-strong", "data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full rtl:data-[starting-style]:translate-x-full rtl:data-[ending-style]:translate-x-full"), onClick: (e) => {
                                // A tap on a link navigates; close the sheet with it.
                                if (e.target.closest("a"))
                                    setOpen(false);
                            }, children: [rail, _jsx("div", { className: "min-w-0 flex-1", children: sidebar })] })] }) }), _jsxs("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col", children: [_jsx(TopBar, { start: topBar?.start, end: _jsxs(_Fragment, { children: [topBar?.end, presentation ? _jsx(SuiteConnections, {}) : null, _jsx(DemoPanel, {})] }), onOpenNavigation: () => setOpen(true) }), banner, _jsx(DemoSceneBanner, {}), _jsx("main", { id: "ot-main", tabIndex: 0, className: "relative min-h-0 min-w-0 flex-1 overflow-y-auto outline-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus", children: _jsx(DemoStateView, { children: children }) })] })] }));
}
//# sourceMappingURL=SuiteShell.js.map