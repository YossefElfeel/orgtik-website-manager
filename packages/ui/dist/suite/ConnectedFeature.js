"use client";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { LinkSimple, LockSimple, Plugs, CreditCard } from "@phosphor-icons/react";
import { Button } from "../components/Button.js";
import { Skeleton } from "../components/Display.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { useSuite } from "./useSuite.js";
import { suiteText } from "./strings.js";
import { SUITE_TOOLS } from "./registry.js";
export function ConnectedFeature({ requires, source, children, write = true, targetWrite = false, title, compact = false, onTrial, onRequestAccess, onRequestTool, billingHref, settingsHref }) {
    const suite = useSuite(), { locale, Link } = useOrgtik();
    const t = (key) => suiteText(locale, key);
    const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState();
    const state = suite.connectionState(requires, source, write, targetWrite);
    if (suite.loading)
        return _jsx(Skeleton, { className: "h-24 w-full" });
    if (state === "available")
        return _jsx(_Fragment, { children: children });
    const action = state === "not_subscribed" ? suite.isOwner ? onTrial : onRequestTool : state === "no_access" ? onRequestAccess : undefined;
    const run = async () => { if (!action || busy)
        return; setBusy(true); setError(undefined); try {
        await action();
        if (state === "no_access" || !suite.isOwner)
            setSaved(true);
    }
    catch (failure) {
        setError(failure instanceof Error ? failure.message : t("retry"));
    }
    finally {
        setBusy(false);
    } };
    const preview = suite.snapshot?.actor.readOnly;
    const heading = title || t(state === "not_subscribed" ? "needsTool" : state === "no_access" ? "needsAccess" : state === "read_only" ? preview ? "preview" : "readonly" : state === "disabled" ? "disabled" : "denied");
    return _jsxs("section", { "aria-label": heading, className: `flex ${compact ? "flex-row items-center gap-3 p-3" : "flex-col items-start gap-3 p-5"} rounded-card border border-line bg-raised shadow-xs`, children: [_jsx("span", { "aria-hidden": "true", className: "grid size-9 shrink-0 place-items-center rounded-field bg-brand-subtle text-fg-brand", children: state === "not_subscribed" ? _jsx(Plugs, {}) : state === "read_only" ? _jsx(CreditCard, {}) : state === "disabled" ? _jsx(LinkSimple, {}) : _jsx(LockSimple, {}) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h3", { className: "text-body font-semibold text-fg", children: heading }), _jsxs("p", { className: "mt-1 text-body-sm text-fg-muted", children: [SUITE_TOOLS[requires].labels[locale], state === "no_access" ? ` · ${t("accessBody")}` : state === "read_only" && !preview ? ` · ${t("readonlyBody")}` : ""] }), saved ? _jsx("p", { role: "status", className: "mt-2 text-body-sm text-success", children: t("pending") }) : null, error ? _jsx("p", { role: "alert", className: "mt-2 text-body-sm text-danger", children: error }) : null] }), !saved && action ? _jsx(Button, { size: "sm", loading: busy, onClick: run, children: t(state === "not_subscribed" ? suite.isOwner ? "trial" : "requestTool" : "request") }) : null, state === "read_only" && suite.isOwner && !preview && billingHref ? _jsx(Link, { href: billingHref, className: "rounded-pill bg-action-primary px-4 py-2 text-body-sm font-semibold text-on-action-primary", children: t("billing") }) : null, state === "disabled" && settingsHref ? _jsx(Link, { href: settingsHref, className: "text-body-sm text-fg-brand underline", children: t("connectionSettings") }) : null] });
}
//# sourceMappingURL=ConnectedFeature.js.map