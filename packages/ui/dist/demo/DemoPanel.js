"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from "react";
import { ArrowCounterClockwise, CheckCircle, Moon, SlidersHorizontal, Sun, X } from "@phosphor-icons/react";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { useTheme } from "../theme/theme.js";
import { Button } from "../components/Button.js";
import { Badge } from "../components/Badge.js";
import { Field } from "../components/Field.js";
import { IconButton } from "../components/IconButton.js";
import { Select } from "../components/Select.js";
import { SegmentedControl } from "../components/Choice.js";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "../components/Popover.js";
import { EmptyState, ErrorState, LoadingState, NoPermissionState } from "../components/States.js";
import { DEMO_STRINGS } from "./strings.js";
import { PresentationFormatting } from "../provider/OrgtikProvider.js";
export const DEMO_PERSONAS = ["current", "mona", "nour", "rana", "omar", "salma", "hoda", "hany"];
export const DEMO_WORKSPACES = ["current", "orgtik", "nile", "spree", "desert", "new"];
export const DEMO_STATES = ["normal", "loading", "empty", "error", "noAccess", "readOnly", "success"];
export const DEMO_SCENARIOS = ["none", "renewal", "grace", "expiredGrace", "overdue"];
const initial = { persona: "current", workspace: "current", state: "normal", scenario: "none" };
const defaults = { digits: "latn", timeZone: "Africa/Cairo" };
const Context = createContext({ enabled: false, appKey: "suite", preferences: defaults, updatePreferences: () => { }, scene: initial, update: () => { }, reset: () => { }, open: false, setOpen: () => { } });
export const useDemoScene = () => useContext(Context);
const useWords = () => { const { locale } = useOrgtik(); return (key) => DEMO_STRINGS[locale][key]; };
export function DemoProvider({ options, children }) {
    const { locale: currentLocale } = useOrgtik();
    const [scene, setScene] = useState(initial), [open, setOpen] = useState(false);
    const [preferences, setPreferences] = useState(defaults);
    const [, setTheme] = useTheme();
    const key = "orgtik:demo-scene:" + (options?.appKey || "suite");
    useEffect(() => {
        if (!options?.enabled)
            return;
        try {
            const carrier = new URLSearchParams(window.location.search).get("demoScene"), incoming = carrier ? JSON.parse(carrier) : null;
            const saved = incoming?.scene ?? JSON.parse(sessionStorage.getItem(key) || "null");
            if (saved && DEMO_PERSONAS.includes(saved.persona) && DEMO_WORKSPACES.includes(saved.workspace) && DEMO_STATES.includes(saved.state) && DEMO_SCENARIOS.includes(saved.scenario)) {
                setScene(saved);
                sessionStorage.setItem(key, JSON.stringify(saved));
            }
            const prefs = incoming?.preferences ?? JSON.parse(sessionStorage.getItem(key + ":preferences") || "null");
            if (prefs && ["latn", "arab"].includes(prefs.digits) && ["Africa/Cairo", "Europe/Zurich", "Asia/Dubai", "UTC"].includes(prefs.timeZone)) {
                setPreferences(prefs);
                sessionStorage.setItem(key + ":preferences", JSON.stringify(prefs));
            }
            if (incoming?.theme === "light" || incoming?.theme === "dark")
                setTheme(incoming.theme);
            if (incoming?.locale !== currentLocale && ["en", "ar", "de", "fr", "it"].includes(incoming?.locale))
                options?.onLocaleChange?.(incoming.locale);
        }
        catch { }
    }, [key, options?.enabled]);
    const update = (patch) => setScene(current => { const next = { ...current, ...patch }; try {
        sessionStorage.setItem(key, JSON.stringify(next));
    }
    catch { } return next; });
    const reset = () => { setScene(initial); try {
        sessionStorage.removeItem(key);
    }
    catch { } };
    const updatePreferences = (patch) => setPreferences(before => { const next = { ...before, ...patch }; try {
        sessionStorage.setItem(key + ":preferences", JSON.stringify(next));
    }
    catch { } return next; });
    const content = options?.enabled ? _jsx(PresentationFormatting, { digits: preferences.digits, timeZone: preferences.timeZone, children: children }) : children;
    return _jsx(Context.Provider, { value: { enabled: Boolean(options?.enabled), appKey: options?.appKey ?? "suite", runtime: options?.runtime, preferences, updatePreferences, scene, update, reset, open, setOpen, onLocaleChange: options?.onLocaleChange }, children: content });
}
export function SimulatedTag() { const t = useWords(); return _jsx(Badge, { tone: "info", size: "sm", className: "w-fit", children: t("simulated") }); }
export function DemoPanel() {
    const demo = useDemoScene(), t = useWords(), { locale } = useOrgtik(), [theme, setTheme] = useTheme();
    if (!demo.enabled)
        return null;
    const { scene, update } = demo;
    return _jsxs(Popover, { open: demo.open, onOpenChange: demo.setOpen, children: [_jsx(PopoverTrigger, { render: _jsx(Button, { variant: "secondary", size: "sm", "aria-label": t("title"), startIcon: _jsx(SlidersHorizontal, {}) }), children: _jsx("span", { className: "hidden sm:inline", children: t("title") }) }), _jsxs(PopoverContent, { align: "end", className: "w-[min(360px,calc(100vw-2rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto", title: _jsxs("span", { className: "flex items-center justify-between gap-3", children: [t("title"), _jsx(PopoverClose, { render: _jsx(IconButton, { variant: "ghost", size: "sm", label: t("close"), icon: _jsx(X, {}) }) })] }), description: t("body"), children: [_jsx(Badge, { tone: "brand", size: "sm", className: "self-start", children: t("prototype") }), _jsx(Field, { label: t("persona"), children: _jsx(Select, { "aria-label": t("persona"), value: scene.persona, onValueChange: value => value && update({ persona: value }), options: DEMO_PERSONAS.map(value => ({ value, label: t(value) })) }) }), _jsx(Field, { label: t("workspace"), children: _jsx(Select, { "aria-label": t("workspace"), value: scene.workspace, onValueChange: value => value && update({ workspace: value, state: value === "new" ? "empty" : value === "desert" ? "noAccess" : "normal" }), options: DEMO_WORKSPACES.map(value => ({ value, label: t(value) })) }) }), _jsx(Field, { label: t("screen"), children: _jsx(Select, { "aria-label": t("screen"), value: scene.state, onValueChange: value => value && update({ state: value }), options: DEMO_STATES.map(value => ({ value, label: t(value) })) }) }), _jsx(Field, { label: t("scenario"), children: _jsx(Select, { "aria-label": t("scenario"), value: scene.scenario, onValueChange: value => value && update({ scenario: value, state: value === "expiredGrace" ? "readOnly" : "normal" }), options: DEMO_SCENARIOS.map(value => ({ value, label: t(value) })) }) }), ["renewal", "grace", "expiredGrace"].includes(scene.scenario) ? _jsxs("div", { className: "flex flex-col gap-2 rounded-field border border-line p-3", children: [_jsx(SimulatedTag, {}), _jsx("p", { className: "text-body-sm text-fg-muted", children: t("lifecycleNote") }), scene.scenario !== "expiredGrace" ? _jsx(Button, { size: "sm", variant: "secondary", onClick: () => update({ scenario: scene.scenario === "renewal" ? "grace" : "expiredGrace", state: scene.scenario === "renewal" ? "normal" : "readOnly" }), children: t(scene.scenario === "renewal" ? "simulateFailure" : "endGrace") }) : null, _jsx(Button, { size: "sm", variant: "secondary", onClick: () => update({ scenario: "none", state: "normal" }), children: t("simulateRecovery") })] }) : null, _jsx("div", { className: "border-t border-line pt-3", children: _jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [_jsx(Field, { label: t("language"), children: _jsx(Select, { "aria-label": t("language"), value: locale, onValueChange: value => value && demo.onLocaleChange?.(value), disabled: !demo.onLocaleChange, options: [{ value: "en", label: "English" }, { value: "ar", label: "العربية" }, { value: "de", label: "Deutsch" }, { value: "fr", label: "Français" }, { value: "it", label: "Italiano" }] }) }), _jsx(Field, { label: t("theme"), children: _jsx(SegmentedControl, { label: t("theme"), size: "sm", value: theme, onValueChange: setTheme, segments: [{ value: "light", label: t("light"), icon: _jsx(Sun, {}) }, { value: "dark", label: t("dark"), icon: _jsx(Moon, {}) }] }) })] }) }), _jsx("p", { className: "text-caption text-fg-muted", children: t("previewNote") }), _jsx(Field, { label: t("digits"), children: _jsx(Select, { value: demo.preferences.digits, onValueChange: value => value && demo.updatePreferences({ digits: value }), options: [{ value: "latn", label: t("latinDigits") }, { value: "arab", label: t("arabicDigits") }] }) }), _jsx(Field, { label: t("timeZone"), children: _jsx(Select, { value: demo.preferences.timeZone, onValueChange: value => value && demo.updatePreferences({ timeZone: value }), options: ["Africa/Cairo", "Europe/Zurich", "Asia/Dubai", "UTC"].map(value => ({ value, label: value })) }) }), _jsx(Button, { variant: "secondary", startIcon: _jsx(ArrowCounterClockwise, {}), onClick: demo.reset, children: t("reset") })] })] });
}
export function DemoSceneBanner() {
    const { enabled, scene } = useDemoScene(), t = useWords();
    if (!enabled)
        return null;
    if (Object.entries(initial).every(([key, value]) => scene[key] === value))
        return _jsx("div", { className: "border-b border-line bg-raised px-4 py-1.5", children: _jsx(Badge, { tone: "brand", size: "sm", children: t("prototype") }) });
    return _jsxs("div", { role: "status", className: "flex flex-wrap items-center gap-2 border-b border-line bg-brand-subtle px-4 py-2 text-caption text-fg", children: [_jsx(SimulatedTag, {}), _jsx("span", { className: "font-semibold", children: t("scene") }), _jsxs("span", { children: [t(scene.persona), " \u00B7 ", t(scene.workspace), " \u00B7 ", t(scene.state)] }), scene.scenario !== "none" ? _jsxs("span", { className: "text-fg-muted", children: ["\u00B7 ", t(scene.scenario)] }) : null] });
}
export function DemoStateView({ children }) {
    const demo = useDemoScene(), t = useWords();
    if (!demo.enabled)
        return _jsx(_Fragment, { children: children });
    const action = _jsx(Button, { variant: "secondary", onClick: () => demo.update({ state: "normal", scenario: "none" }), children: t("restore") });
    let preview = null;
    switch (demo.scene.state) {
        case "loading":
            preview = _jsx("div", { className: "mx-auto max-w-4xl p-6", children: _jsx(LoadingState, { rows: 8, label: t("loadingBody") }) });
            break;
        case "empty":
            preview = _jsx(EmptyState, { titleAs: "h1", title: t("emptyTitle"), description: t("emptyBody"), action: action });
            break;
        case "error":
            preview = _jsx(ErrorState, { titleAs: "h1", title: t("errorTitle"), description: t("errorBody"), onRetry: () => demo.update({ state: "normal" }) });
            break;
        case "noAccess":
            preview = _jsx(NoPermissionState, { titleAs: "h1", title: t("noAccessTitle"), description: t("noAccessBody"), action: action });
            break;
        case "success":
            preview = _jsx(EmptyState, { titleAs: "h1", icon: _jsx(CheckCircle, {}), title: t("successTitle"), description: t("successBody"), action: action });
            break;
        case "readOnly":
            preview = _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-line bg-warning-subtle px-4 py-3", children: [_jsx("p", { className: "text-body-sm text-fg", children: t("readOnlyBody") }), action] });
            break;
    }
    // Keep local edits mounted while demonstrating a temporary state or billing recovery.
    return _jsxs(_Fragment, { children: [preview, _jsx("div", { className: "min-w-0", hidden: !["normal", "readOnly"].includes(demo.scene.state), inert: demo.scene.state === "readOnly" ? true : undefined, children: children })] });
}
//# sourceMappingURL=DemoPanel.js.map