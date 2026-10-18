"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Bell } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover.js";
import { IconButton } from "./IconButton.js";
import { Button } from "./Button.js";
import { Skeleton } from "./Display.js";
import { useFormatter, useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
const EMPTY_ITEMS = [];
export function NotificationCenter({ items = EMPTY_ITEMS, load, onRead, onReadAll, onSelect }) {
    const [open, setOpen] = useState(false), [records, setRecords] = useState(items), [busy, setBusy] = useState(false), [error, setError] = useState();
    const { locale } = useOrgtik(), f = useFormatter(), t = (key) => suiteText(locale, key);
    useEffect(() => setRecords(items), [items]);
    useEffect(() => { if (!open || !load)
        return; let live = true; setBusy(true); setError(undefined); load().then(data => { if (live)
        setRecords(data); }).catch(failure => { if (live)
        setError(failure instanceof Error ? failure.message : t("retry")); }).finally(() => { if (live)
        setBusy(false); }); return () => { live = false; }; }, [open, load]);
    const unread = records.filter(item => !item.read).length;
    const readAll = async () => { setBusy(true); setError(undefined); try {
        await onReadAll?.();
        setRecords(previous => previous.map(item => ({ ...item, read: true })));
    }
    catch (failure) {
        setError(failure instanceof Error ? failure.message : t("retry"));
    }
    finally {
        setBusy(false);
    } };
    const choose = async (item) => { setError(undefined); try {
        if (!item.read && onRead)
            await onRead(item.id);
        await onSelect(item);
        setRecords(previous => previous.map(record => record.id === item.id ? { ...record, read: true } : record));
        setOpen(false);
    }
    catch (failure) {
        setError(failure instanceof Error ? failure.message : t("retry"));
    } };
    return _jsxs(Popover, { open: open, onOpenChange: setOpen, children: [_jsx(PopoverTrigger, { render: _jsx(IconButton, { label: `${t("notifications")}${unread ? ` (${f.number(unread)})` : ""}`, icon: _jsxs("span", { className: "relative", children: [_jsx(Bell, {}), unread ? _jsx("span", { className: "absolute -end-0.5 -top-0.5 size-1.5 rounded-pill bg-danger-solid" }) : null] }) }) }), _jsxs(PopoverContent, { align: "end", className: "w-96", children: [_jsxs("header", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "text-body font-semibold", children: t("notifications") }), unread && onReadAll ? _jsx(Button, { size: "xs", variant: "ghost", shape: "control", disabled: busy, onClick: readAll, children: t("markAll") }) : null] }), error ? _jsx("p", { role: "alert", className: "text-body-sm text-danger", children: error }) : null, busy ? _jsx(Skeleton, { className: "h-20" }) : null, _jsx("ul", { className: "max-h-96 space-y-1 overflow-y-auto", children: records.map(item => _jsx("li", { children: _jsxs("button", { type: "button", onClick: () => choose(item), className: `flex w-full flex-col gap-1 rounded-field p-3 text-start hover:bg-hover ${!item.read ? "bg-brand-subtle" : ""}`, children: [_jsx("span", { dir: "auto", className: "text-body-sm font-semibold", children: item.title }), item.subtitle ? _jsx("span", { dir: "auto", className: "text-caption text-fg-muted", children: item.subtitle }) : null, _jsx("time", { dateTime: item.at, className: "text-caption text-fg-subtle", children: f.date(item.at, { dateStyle: "medium", timeStyle: "short" }) })] }) }, item.id)) }), !busy && !records.length ? _jsx("p", { className: "py-6 text-center text-body-sm text-fg-muted", children: t("allCaughtUp") }) : null] })] });
}
//# sourceMappingURL=NotificationCenter.js.map