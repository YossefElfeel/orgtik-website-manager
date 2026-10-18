"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { PencilSimple, Check, X } from "@phosphor-icons/react";
import { Input } from "./Input.js";
import { IconButton } from "./IconButton.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
export function InlineEdit({ value, label, onSave, disabled, validate, placeholder }) {
    const [editing, setEditing] = useState(false), [draft, setDraft] = useState(value), [busy, setBusy] = useState(false), [error, setError] = useState();
    const input = useRef(null), { locale } = useOrgtik();
    useEffect(() => { if (!editing)
        setDraft(value); }, [value, editing]);
    useEffect(() => { if (editing)
        input.current?.focus(); }, [editing]);
    const save = async () => { const problem = validate?.(draft); if (problem) {
        setError(problem);
        return;
    } setBusy(true); setError(undefined); try {
        await onSave(draft);
        setEditing(false);
    }
    catch (failure) {
        setError(failure instanceof Error ? failure.message : suiteText(locale, "retry"));
    }
    finally {
        setBusy(false);
    } };
    if (!editing)
        return _jsxs("button", { type: "button", disabled: disabled, "aria-label": label, onClick: () => setEditing(true), className: "group inline-flex min-w-0 items-center gap-2 rounded-field px-1 py-1 text-start text-body hover:bg-hover disabled:cursor-default", children: [_jsx("span", { dir: "auto", className: "truncate", children: value || placeholder }), !disabled ? _jsx(PencilSimple, { "aria-hidden": "true", className: "size-3.5 shrink-0 text-fg-subtle" }) : null] });
    return _jsxs("div", { className: "flex min-w-0 flex-col gap-1", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Input, { ref: input, size: "sm", value: draft, "aria-label": label, disabled: busy, "aria-invalid": Boolean(error), onChange: event => setDraft(event.target.value), onKeyDown: event => { if (event.key === "Enter") {
                            event.preventDefault();
                            void save();
                        } if (event.key === "Escape" && !busy)
                            setEditing(false); } }), _jsx(IconButton, { size: "sm", label: suiteText(locale, "save"), icon: _jsx(Check, {}), disabled: busy, onClick: save }), _jsx(IconButton, { size: "sm", label: suiteText(locale, "cancel"), icon: _jsx(X, {}), disabled: busy, onClick: () => setEditing(false) })] }), error ? _jsx("p", { role: "alert", className: "text-caption text-danger", children: error }) : null] });
}
//# sourceMappingURL=InlineEdit.js.map