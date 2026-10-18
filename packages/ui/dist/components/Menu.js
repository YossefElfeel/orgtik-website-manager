"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { CaretRight, Check } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { floatingPopup, listItem } from "../lib/overlay.js";
// Replaces the apps' dropdown-menu. Submenus open toward the reading end (spike base-ui-rtl).
export const Menu = BaseMenu.Root;
/** <MenuTrigger render={<IconButton label="More actions" icon={…} />} /> */
export const MenuTrigger = BaseMenu.Trigger;
export const MenuRadioGroup = BaseMenu.RadioGroup;
export const MenuSub = BaseMenu.SubmenuRoot;
export function MenuContent({ children, className, side = "bottom", align = "start", sideOffset = 6 }) {
    return (_jsx(BaseMenu.Portal, { children: _jsx(BaseMenu.Positioner, { side: side, align: align, sideOffset: sideOffset, className: "z-50 outline-none", children: _jsx(BaseMenu.Popup, { className: cn(floatingPopup, "min-w-48 p-1", className), children: children }) }) }));
}
const Icon = ({ children }) => (_jsx("span", { "aria-hidden": "true", className: "grid size-4 shrink-0 place-items-center text-fg-muted group-data-[tone=danger]:text-danger", children: children }));
export function MenuItem({ icon, shortcut, tone = "default", className, children, ...props }) {
    return (_jsxs(BaseMenu.Item, { "data-tone": tone, className: cn(listItem, "group", tone === "danger" && "text-danger", className), ...props, children: [icon ? _jsx(Icon, { children: icon }) : null, _jsx("span", { className: "flex-1 truncate", children: children }), shortcut ? _jsx("kbd", { dir: "ltr", className: "ms-6 font-body text-caption text-fg-subtle", children: shortcut }) : null] }));
}
/** A menu row that navigates. Renders a real link, so it opens in a new tab with a modifier key. */
export function MenuLinkItem({ icon, className, children, ...props }) {
    return (_jsxs(BaseMenu.LinkItem, { className: cn(listItem, className), ...props, children: [icon ? _jsx(Icon, { children: icon }) : null, _jsx("span", { className: "flex-1 truncate", children: children })] }));
}
export function MenuCheckboxItem({ className, children, ...props }) {
    return (_jsxs(BaseMenu.CheckboxItem, { className: cn(listItem, className), ...props, children: [_jsx("span", { className: "grid size-4 shrink-0 place-items-center text-fg-brand", children: _jsx(BaseMenu.CheckboxItemIndicator, { children: _jsx(Check, { weight: "bold", className: "size-3.5" }) }) }), _jsx("span", { className: "flex-1 truncate", children: children })] }));
}
export function MenuRadioItem({ className, children, ...props }) {
    return (_jsxs(BaseMenu.RadioItem, { className: cn(listItem, className), ...props, children: [_jsx("span", { className: "grid size-4 shrink-0 place-items-center text-fg-brand", children: _jsx(BaseMenu.RadioItemIndicator, { children: _jsx("span", { className: "block size-2 rounded-pill bg-current" }) }) }), _jsx("span", { className: "flex-1 truncate", children: children })] }));
}
export function MenuSubTrigger({ icon, className, children, ...props }) {
    return (_jsxs(BaseMenu.SubmenuTrigger, { className: cn(listItem, "data-[popup-open]:bg-hover", className), ...props, children: [icon ? _jsx(Icon, { children: icon }) : null, _jsx("span", { className: "flex-1 truncate", children: children }), _jsx(CaretRight, { "aria-hidden": "true", className: "size-3.5 text-fg-subtle rtl:-scale-x-100" })] }));
}
export function MenuSubContent({ children, className }) {
    return (_jsx(BaseMenu.Portal, { children: _jsx(BaseMenu.Positioner, { side: "inline-end", align: "start", sideOffset: 4, alignOffset: -4, className: "z-50 outline-none", children: _jsx(BaseMenu.Popup, { className: cn(floatingPopup, "min-w-44 p-1", className), children: children }) }) }));
}
export function MenuSeparator({ className }) {
    return _jsx(BaseMenu.Separator, { className: cn("mx-2 my-1 h-px bg-line", className) });
}
/** Related items under a heading. The heading is how screen readers name the group. */
export function MenuGroup({ label, children, className }) {
    return (_jsxs(BaseMenu.Group, { className: className, children: [label ? _jsx(MenuLabel, { children: label }) : null, children] }));
}
/** A group heading. Only valid inside MenuGroup or MenuRadioGroup; MenuGroup's `label` adds it for you. */
export function MenuLabel({ className, ...props }) {
    return _jsx(BaseMenu.GroupLabel, { className: cn("px-2 pt-1.5 pb-1 text-caption font-semibold text-fg-subtle", className), ...props });
}
//# sourceMappingURL=Menu.js.map