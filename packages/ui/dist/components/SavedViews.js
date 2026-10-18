"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { BookmarkSimple, Plus, X } from "@phosphor-icons/react";
import { Button } from "./Button.js";
import { Input } from "./Input.js";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
export function SavedViews({ views, selected, onSelect, onSave, onDelete }) {
    const [name, setName] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState();
    const { locale } = useOrgtik(), t = (key) => suiteText(locale, key);
    const save = async () => { if (!name.trim() || !onSave)
        return; setBusy(true); setError(undefined); try {
        await onSave(name.trim());
        setName("");
    }
    catch (failure) {
        setError(failure instanceof Error ? failure.message : t("retry"));
    }
    finally {
        setBusy(false);
    } };
    return _jsxs(Popover, { children: [_jsx(PopoverTrigger, { render: _jsx(Button, { size: "sm", shape: "control", variant: "secondary", startIcon: _jsx(BookmarkSimple, {}), children: views.find(view => view.id === selected)?.name || t("savedViews") }) }), _jsx(PopoverContent, { align: "start", className: "w-72", children: _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "text-body-sm font-semibold", children: t("savedViews") }), views.map(view => _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { shape: "control", size: "sm", variant: view.id === selected ? "secondary" : "ghost", className: "flex-1 justify-start", onClick: () => onSelect(view), children: view.name }), onDelete ? _jsx(Button, { size: "xs", variant: "ghost", shape: "control", onClick: () => onDelete(view.id), "aria-label": `${t("remove")} ${view.name}`, children: _jsx(X, { "aria-hidden": "true" }) }) : null] }, view.id)), onSave ? _jsxs("div", { className: "mt-2 flex flex-col gap-2 border-t border-line pt-3", children: [_jsx(Input, { size: "sm", value: name, onChange: event => setName(event.target.value), "aria-label": t("viewName") }), _jsx(Button, { size: "sm", shape: "control", loading: busy, disabled: !name.trim(), startIcon: _jsx(Plus, {}), onClick: save, children: t("saveView") })] }) : null, error ? _jsx("p", { role: "alert", className: "text-caption text-danger", children: error }) : null] }) })] });
}
//# sourceMappingURL=SavedViews.js.map