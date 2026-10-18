"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from "react";
import { MagnifyingGlass, ArrowElbowDownLeft as ArrowReturnLeft } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle } from "./Dialog.js";
import { IconButton } from "./IconButton.js";
import { Input } from "./Input.js";
import { Kbd } from "./Kbd.js";
import { Skeleton } from "./Display.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
const EMPTY_ITEMS = [];
export function CommandPalette({ items = EMPTY_ITEMS, load, onSelect }) {
    const { locale } = useOrgtik(), t = (key) => suiteText(locale, key);
    const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [results, setResults] = useState(items), [busy, setBusy] = useState(false), [active, setActive] = useState(0), [error, setError] = useState();
    const id = useId(), input = useRef(null);
    useEffect(() => { const key = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(previous => !previous);
    } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
    useEffect(() => {
        if (!open)
            return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setActive(0);
            setError(undefined);
            if (!load) {
                setResults(items.filter(item => `${item.title} ${item.subtitle || ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
                return;
            }
            setBusy(true);
            load(query, controller.signal).then(data => { if (!controller.signal.aborted)
                setResults(data); }).catch(failure => { if (!controller.signal.aborted)
                setError(failure instanceof Error ? failure.message : t("retry")); }).finally(() => { if (!controller.signal.aborted)
                setBusy(false); });
        }, 150);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [query, open, items, load, locale]);
    const choose = async (item) => { setBusy(true); setError(undefined); try {
        await onSelect(item);
        setOpen(false);
    }
    catch (failure) {
        setError(failure instanceof Error ? failure.message : t("retry"));
    }
    finally {
        setBusy(false);
    } };
    return _jsxs(_Fragment, { children: [_jsx(IconButton, { label: t("search"), icon: _jsx(MagnifyingGlass, {}), onClick: () => { setQuery(""); setOpen(true); } }), _jsx(Dialog, { open: open, onOpenChange: setOpen, children: _jsxs(DialogContent, { className: "max-w-2xl p-0", children: [_jsxs("div", { className: "border-b border-line p-4 pe-12", children: [_jsx(DialogTitle, { className: "sr-only", children: t("search") }), _jsx(Input, { ref: input, type: "search", role: "combobox", "aria-expanded": open, "aria-controls": id, "aria-autocomplete": "list", "aria-activedescendant": results[active] ? `${id}-${active}` : undefined, "aria-label": t("search"), placeholder: t("search"), value: query, onChange: event => setQuery(event.target.value), startIcon: _jsx(MagnifyingGlass, {}), onKeyDown: event => { if (event.key === "ArrowDown") {
                                        event.preventDefault();
                                        setActive(index => Math.min(results.length - 1, index + 1));
                                    } if (event.key === "ArrowUp") {
                                        event.preventDefault();
                                        setActive(index => Math.max(0, index - 1));
                                    } if (event.key === "Enter" && results[active] && !busy) {
                                        event.preventDefault();
                                        void choose(results[active]);
                                    } } })] }), _jsxs("div", { className: "max-h-96 overflow-y-auto p-2", children: [busy ? _jsxs("div", { "aria-busy": "true", className: "space-y-2 p-3", children: [_jsx(Skeleton, { className: "h-10" }), _jsx(Skeleton, { className: "h-10" })] }) : null, error ? _jsx("p", { role: "alert", className: "p-3 text-body-sm text-danger", children: error }) : null, _jsx("ul", { id: id, role: "listbox", "aria-label": t("search"), className: "flex flex-col gap-1", children: results.map((item, index) => _jsx("li", { role: "none", children: _jsxs("button", { id: `${id}-${index}`, role: "option", "aria-selected": active === index, type: "button", onMouseEnter: () => setActive(index), onClick: () => choose(item), disabled: busy, className: `flex w-full items-center gap-3 rounded-field p-3 text-start ${active === index ? "bg-brand-subtle" : "hover:bg-hover"}`, children: [_jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { dir: "auto", className: "block truncate text-body font-semibold", children: item.title }), item.subtitle ? _jsx("span", { dir: "auto", className: "block truncate text-caption text-fg-muted", children: item.subtitle }) : null] }), _jsx("span", { className: "text-caption text-fg-subtle", children: item.tool }), _jsx(ArrowReturnLeft, { "aria-hidden": "true", className: "size-4 text-fg-subtle" })] }) }, `${item.tool}:${item.id}`)) }), !busy && !results.length ? _jsx("p", { className: "p-6 text-center text-body-sm text-fg-muted", children: t("noResults") }) : null] }), _jsxs("footer", { className: "flex items-center gap-2 border-t border-line px-4 py-3 text-caption text-fg-muted", children: [_jsx(Kbd, { children: "Esc" }), t("close"), _jsxs("span", { className: "ms-auto", children: [_jsx(Kbd, { children: "\u2318" }), _jsx(Kbd, { children: "K" })] })] })] }) })] });
}
//# sourceMappingURL=CommandPalette.js.map