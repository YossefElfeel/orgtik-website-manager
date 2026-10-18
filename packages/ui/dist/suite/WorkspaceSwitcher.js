"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Buildings, Plus } from "@phosphor-icons/react";
import { Menu, MenuContent, MenuItem, MenuTrigger, MenuSeparator } from "../components/Menu.js";
import { Button } from "../components/Button.js";
export function WorkspaceSwitcher({ workspaces, selected, label, onChange, onCreate, createLabel }) {
    const current = workspaces.find(workspace => workspace.id === selected);
    if (workspaces.length < 2 && !onCreate)
        return _jsxs("span", { className: "inline-flex items-center gap-2 text-body-sm font-semibold", children: [_jsx(Buildings, { "aria-hidden": "true", className: "size-4 text-fg-subtle" }), _jsx("span", { dir: "auto", children: current?.name || label })] });
    return _jsxs(Menu, { children: [_jsx(MenuTrigger, { render: _jsx(Button, { shape: "control", variant: "ghost", size: "sm", "aria-label": label, startIcon: _jsx(Buildings, {}), children: current?.name || label }) }), _jsxs(MenuContent, { align: "start", children: [workspaces.map(workspace => _jsxs(MenuItem, { onClick: () => onChange(workspace.id), children: [_jsx("span", { dir: "auto", className: "min-w-0 flex-1 truncate", children: workspace.name }), workspace.role ? _jsx("span", { className: "text-caption text-fg-subtle", children: workspace.role }) : null] }, workspace.id)), onCreate ? _jsxs(_Fragment, { children: [_jsx(MenuSeparator, {}), _jsx(MenuItem, { icon: _jsx(Plus, {}), onClick: onCreate, children: createLabel || label })] }) : null] })] });
}
//# sourceMappingURL=WorkspaceSwitcher.js.map