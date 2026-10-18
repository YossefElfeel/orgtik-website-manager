"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "../lib/cn.js";
import { floatingPopup } from "../lib/overlay.js";
export const Popover = BasePopover.Root;
/** <PopoverTrigger render={<Button variant="secondary" />}>Filters</PopoverTrigger> */
export const PopoverTrigger = BasePopover.Trigger;
export const PopoverClose = BasePopover.Close;
export function PopoverContent({ children, className, side = "bottom", align = "start", sideOffset = 8, title, description, }) {
    return (_jsx(BasePopover.Portal, { children: _jsx(BasePopover.Positioner, { side: side, align: align, sideOffset: sideOffset, className: "z-50 outline-none", children: _jsxs(BasePopover.Popup, { className: cn(floatingPopup, "flex max-w-[min(360px,calc(100vw-2rem))] flex-col gap-3 p-4", className), children: [title || description ? (_jsxs("div", { className: "flex flex-col gap-1", children: [title ? _jsx(BasePopover.Title, { className: "text-title-sm text-fg", children: title }) : null, description ? _jsx(BasePopover.Description, { className: "text-body-sm text-fg-muted", children: description }) : null] })) : null, children] }) }) }));
}
/** Put one near the app root so tooltips next to each other open without a second delay. */
export function TooltipProvider({ children, delay = 500 }) {
    return _jsx(BaseTooltip.Provider, { delay: delay, children: children });
}
/**
 * A short hint on hover and keyboard focus. It must never hold the only way to do something or
 * the only copy of information (no hover-only actions); an IconButton's label already gives it a
 * name, so this is extra.
 */
export function Tooltip({ content, children, side = "top", align = "center" }) {
    return (_jsxs(BaseTooltip.Root, { children: [_jsx(BaseTooltip.Trigger, { render: children }), _jsx(BaseTooltip.Portal, { children: _jsx(BaseTooltip.Positioner, { side: side, align: align, sideOffset: 6, className: "z-50", children: _jsx(BaseTooltip.Popup, { className: cn("max-w-64 rounded-field bg-chrome px-2.5 py-1.5 text-caption text-fg-on-chrome shadow-overlay", "origin-(--transform-origin) transition-[opacity,scale] duration-(--ot-duration-instant) ease-ot-out", "data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"), children: content }) }) })] }));
}
//# sourceMappingURL=Popover.js.map