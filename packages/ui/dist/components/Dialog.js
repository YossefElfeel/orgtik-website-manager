"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cva } from "class-variance-authority";
import { X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { scrim } from "../lib/overlay.js";
import { useStrings } from "../provider/OrgtikProvider.js";
// shadcn-shaped names, so the app shims can re-export them under today's import paths.
export const Dialog = BaseDialog.Root;
/** Opens the dialog. Pass your button through `render`: <DialogTrigger render={<Button />}>Edit</DialogTrigger> */
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;
const dialogPopup = cva([
    "fixed start-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-y-1/2 flex-col",
    "ltr:-translate-x-1/2 rtl:translate-x-1/2",
    "rounded-panel border border-line bg-overlay text-fg shadow-overlay outline-none",
    "transition-[opacity,scale] duration-(--ot-duration-base) ease-ot-out-strong",
    "data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0",
    // A dialog opened from this one pushes it back a little.
    "data-[nested-dialog-open]:scale-[0.97] data-[nested-dialog-open]:opacity-80",
], {
    variants: {
        size: { sm: "max-w-[400px]", md: "max-w-[560px]", lg: "max-w-[760px]", xl: "max-w-[1040px]" },
    },
    defaultVariants: { size: "md" },
});
function CloseButton() {
    const t = useStrings();
    return (_jsx(BaseDialog.Close, { "aria-label": t("close"), title: t("close"), className: "absolute end-3 top-3 grid size-control-sm place-items-center rounded-pill text-fg-muted transition-colors hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus", children: _jsx(X, { "aria-hidden": "true", className: "size-4" }) }));
}
export function DialogContent({ className, size, hideClose = false, children, ...props }) {
    return (_jsxs(BaseDialog.Portal, { children: [_jsx(BaseDialog.Backdrop, { className: scrim }), _jsxs(BaseDialog.Popup, { className: cn(dialogPopup({ size }), className), ...props, children: [children, hideClose ? null : _jsx(CloseButton, {})] })] }));
}
export function DialogHeader({ className, ...props }) {
    return _jsx("div", { className: cn("flex flex-col gap-1.5 px-6 pt-6 pe-14", className), ...props });
}
/** The scrolling middle. Header and footer stay put. */
export function DialogBody({ className, ...props }) {
    return _jsx("div", { className: cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", className), ...props });
}
/** Actions, at the reading end. The primary action goes last. */
export function DialogFooter({ className, ...props }) {
    return _jsx("div", { className: cn("flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4", className), ...props });
}
export function DialogTitle({ className, ...props }) {
    return _jsx(BaseDialog.Title, { className: cn("font-display text-title text-fg", className), ...props });
}
export function DialogDescription({ className, ...props }) {
    return _jsx(BaseDialog.Description, { className: cn("text-body text-fg-muted", className), ...props });
}
// Sheet: the same dialog, docked to an edge. "end" is the right in LTR and the left in RTL.
const sheetPopup = cva([
    "fixed z-50 flex flex-col bg-overlay text-fg shadow-overlay outline-none",
    "transition-transform duration-(--ot-duration-slow) ease-ot-out-strong",
], {
    variants: {
        side: {
            end: [
                "inset-y-0 end-0 w-[min(100vw,var(--sheet-width,440px))] border-s border-line rounded-s-panel",
                "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
                "rtl:data-[starting-style]:-translate-x-full rtl:data-[ending-style]:-translate-x-full",
            ],
            start: [
                "inset-y-0 start-0 w-[min(100vw,var(--sheet-width,440px))] border-e border-line rounded-e-panel",
                "data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full",
                "rtl:data-[starting-style]:translate-x-full rtl:data-[ending-style]:translate-x-full",
            ],
            bottom: [
                "inset-x-0 bottom-0 max-h-[85dvh] border-t border-line rounded-t-panel",
                "data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full",
            ],
        },
    },
    defaultVariants: { side: "end" },
});
export const Sheet = BaseDialog.Root;
export const SheetTrigger = BaseDialog.Trigger;
export const SheetClose = BaseDialog.Close;
export function SheetContent({ className, side, hideClose = false, children, ...props }) {
    return (_jsxs(BaseDialog.Portal, { children: [_jsx(BaseDialog.Backdrop, { className: scrim }), _jsxs(BaseDialog.Popup, { className: cn(sheetPopup({ side }), className), ...props, children: [children, hideClose ? null : _jsx(CloseButton, {})] })] }));
}
//# sourceMappingURL=Dialog.js.map