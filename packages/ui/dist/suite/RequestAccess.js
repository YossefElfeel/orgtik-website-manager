"use client";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Button } from "../components/Button.js";
import { Textarea } from "../components/Input.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "./strings.js";
export function RequestAccess({ title, description, onRequest, reasonLabel, disabled }) {
    const { locale } = useOrgtik(), [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState();
    const request = async () => { setBusy(true); setError(undefined); try {
        await onRequest(reason.trim());
        setSent(true);
    }
    catch (failure) {
        setError(failure instanceof Error ? failure.message : suiteText(locale, "retry"));
    }
    finally {
        setBusy(false);
    } };
    return _jsxs("section", { className: "flex flex-col gap-3 rounded-card border border-line bg-raised p-5 shadow-xs", children: [_jsx("h3", { className: "text-body font-semibold", children: title }), description ? _jsx("p", { className: "text-body-sm text-fg-muted", children: description }) : null, sent ? _jsx("p", { role: "status", className: "text-body-sm text-success", children: suiteText(locale, "pending") }) : _jsxs(_Fragment, { children: [reasonLabel ? _jsx(Textarea, { "aria-label": reasonLabel, placeholder: reasonLabel, maxLength: 1000, value: reason, disabled: disabled || busy, onChange: event => setReason(event.target.value), rows: 2 }) : null, _jsx(Button, { size: "sm", className: "self-start", loading: busy, disabled: disabled, onClick: request, children: suiteText(locale, "request") })] }), error ? _jsx("p", { role: "alert", className: "text-body-sm text-danger", children: error }) : null] });
}
//# sourceMappingURL=RequestAccess.js.map