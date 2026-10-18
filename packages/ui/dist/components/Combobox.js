"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo } from "react";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { CaretDown, Check, MagnifyingGlass, X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { controlFrame } from "../lib/control.js";
import { floatingPopup, listItem } from "../lib/overlay.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
function Popup({ emptyText }) {
    const t = useStrings();
    return (_jsx(BaseCombobox.Portal, { children: _jsx(BaseCombobox.Positioner, { sideOffset: 6, className: "z-50 outline-none", children: _jsxs(BaseCombobox.Popup, { className: cn(floatingPopup, "max-h-[min(var(--available-height),22rem)] w-(--anchor-width) overflow-y-auto p-1"), children: [_jsx(BaseCombobox.Empty, { className: "px-3 py-2 text-body-sm text-fg-subtle empty:hidden", children: emptyText ?? t("noResults") }), _jsx(BaseCombobox.List, { children: (o) => (_jsxs(BaseCombobox.Item, { value: o, disabled: o.disabled, className: cn(listItem, "py-1.5"), children: [_jsx("span", { className: "grid size-4 shrink-0 place-items-center text-fg-brand", children: _jsx(BaseCombobox.ItemIndicator, { children: _jsx(Check, { weight: "bold", className: "size-3.5" }) }) }), _jsxs("span", { className: "flex min-w-0 flex-col", children: [_jsx("span", { dir: "auto", className: "truncate", children: o.label }), o.hint ? _jsx("span", { dir: "auto", className: "truncate text-caption text-fg-subtle", children: o.hint }) : null] })] }, o.value)) })] }) }) }));
}
/** Pick one from many by typing (people, folders, countries). For a short fixed list use Select. */
export function Combobox({ options, value, defaultValue, onValueChange, placeholder, size, emptyText, className, "aria-label": ariaLabel, ...props }) {
    const { locale } = useOrgtik();
    const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
    const t = useStrings();
    return (_jsxs(BaseCombobox.Root, { items: options, locale: locale, itemToStringLabel: (o) => o.label, isItemEqualToValue: (a, b) => a.value === b.value, value: value === undefined ? undefined : value === null ? null : byValue.get(value) ?? null, defaultValue: defaultValue ? byValue.get(defaultValue) ?? null : undefined, onValueChange: (o) => onValueChange?.((o?.value ?? null)), ...props, children: [_jsxs("div", { className: cn(controlFrame({ size }), "flex items-center gap-2 ps-3 pe-1", className), children: [_jsx(MagnifyingGlass, { "aria-hidden": "true", className: "size-4 shrink-0 text-fg-subtle" }), _jsx(BaseCombobox.Input, { "aria-label": ariaLabel, placeholder: placeholder, className: "h-full min-w-0 flex-1 bg-transparent text-start outline-none placeholder:text-fg-subtle" }), _jsx(BaseCombobox.Clear, { "aria-label": t("clear"), className: "grid size-7 place-items-center rounded-pill text-fg-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus", children: _jsx(X, { "aria-hidden": "true", className: "size-3.5" }) }), _jsx(BaseCombobox.Trigger, { "aria-label": ariaLabel, className: "grid size-7 place-items-center rounded-pill text-fg-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus", children: _jsx(CaretDown, { "aria-hidden": "true", className: "size-4" }) })] }), _jsx(Popup, { emptyText: emptyText })] }));
}
/** Pick several (people to share with, tags). Chosen items show as removable chips. */
export function MultiSelect({ options, value, defaultValue, onValueChange, placeholder, size, emptyText, className, "aria-label": ariaLabel, ...props }) {
    const t = useStrings();
    const { locale } = useOrgtik();
    const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
    const pick = (vs) => (vs ? vs.map((v) => byValue.get(v)).filter((o) => Boolean(o)) : undefined);
    return (_jsxs(BaseCombobox.Root, { multiple: true, items: options, locale: locale, itemToStringLabel: (o) => o.label, isItemEqualToValue: (a, b) => a.value === b.value, value: pick(value), defaultValue: pick(defaultValue), onValueChange: (os) => onValueChange?.(os.map((o) => o.value)), ...props, children: [_jsx(BaseCombobox.Chips, { className: cn(controlFrame({ size }), "flex h-auto min-h-control-md flex-wrap items-center gap-1.5 px-2 py-1.5", className), children: _jsx(BaseCombobox.Value, { children: (chosen) => (_jsxs(_Fragment, { children: [chosen.map((o) => (_jsxs(BaseCombobox.Chip, { className: "inline-flex h-7 items-center gap-1 rounded-pill bg-brand-subtle ps-2.5 pe-1 text-body-sm text-fg-brand outline-hidden focus-visible:outline-2 focus-visible:outline-focus", children: [_jsx("span", { dir: "auto", children: o.label }), _jsx(BaseCombobox.ChipRemove, { "aria-label": t("removeItem", { label: o.label }), className: "grid size-5 place-items-center rounded-pill hover:bg-hover", children: _jsx(X, { "aria-hidden": "true", className: "size-3" }) })] }, o.value))), _jsx(BaseCombobox.Input, { "aria-label": ariaLabel, placeholder: chosen.length ? "" : placeholder, className: "h-7 min-w-24 flex-1 bg-transparent px-1 text-start outline-none placeholder:text-fg-subtle" })] })) }) }), _jsx(Popup, { emptyText: emptyText })] }));
}
//# sourceMappingURL=Combobox.js.map