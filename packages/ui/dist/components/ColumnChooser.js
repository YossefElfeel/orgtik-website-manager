"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Columns } from "@phosphor-icons/react";
import { Checkbox } from "./Checkbox.js";
import { Button } from "./Button.js";
import { Popover, PopoverTrigger, PopoverContent } from "./Popover.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
export function ColumnChooser({ columns, onChange }) {
    const { locale } = useOrgtik(), label = suiteText(locale, "columns");
    return _jsxs(Popover, { children: [_jsx(PopoverTrigger, { render: _jsx(Button, { variant: "secondary", shape: "control", size: "sm", startIcon: _jsx(Columns, {}), children: label }) }), _jsx(PopoverContent, { align: "end", className: "min-w-52", children: _jsxs("div", { className: "flex flex-col gap-3 p-1", children: [_jsx("p", { className: "text-body-sm font-semibold", children: label }), columns.map(column => _jsxs("label", { className: "flex items-center gap-2 text-body-sm", children: [_jsx(Checkbox, { checked: column.visible, disabled: column.required, onCheckedChange: visible => onChange(column.id, Boolean(visible)) }), _jsx("span", { children: column.label })] }, column.id))] }) })] });
}
//# sourceMappingURL=ColumnChooser.js.map