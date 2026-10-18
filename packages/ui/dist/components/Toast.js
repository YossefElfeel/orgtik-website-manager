"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Toast as BaseToast } from "@base-ui/react/toast";
import { CheckCircle, Info, Warning, WarningCircle, X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";
// One manager for the whole app, so `toast.success()` works from anywhere (RTK Query callbacks,
// event handlers), the way the apps use sonner today.
const manager = BaseToast.createToastManager();
function add(kind, title, options = {}) {
    const { action, ...rest } = options;
    return manager.add({
        type: kind,
        title,
        // Errors stay until dismissed: they usually need reading or acting on.
        timeout: kind === "error" ? 0 : 5000,
        priority: kind === "error" ? "high" : "low",
        actionProps: action ? { children: action.label, onClick: action.onClick } : undefined,
        ...rest,
    });
}
/**
 * Show a success toast only after the server answered 2xx, never optimistically: a toast that
 * says "Saved" when nothing was saved is worse than none.
 */
export const toast = {
    success: (title, options) => add("success", title, options),
    error: (title, options) => add("error", title, options),
    warning: (title, options) => add("warning", title, options),
    info: (title, options) => add("info", title, options),
    dismiss: (id) => manager.close(id),
    /** Loading, then success or error, in one toast. */
    promise: (p, labels) => manager.promise(p, {
        loading: { title: labels.loading, type: "loading" },
        success: (v) => ({ title: typeof labels.success === "function" ? labels.success(v) : labels.success, type: "success" }),
        error: (e) => ({ title: typeof labels.error === "function" ? labels.error(e) : labels.error, type: "error", timeout: 0 }),
    }),
};
const ICONS = {
    success: _jsx(CheckCircle, { weight: "fill", className: "text-success" }),
    error: _jsx(WarningCircle, { weight: "fill", className: "text-danger" }),
    warning: _jsx(Warning, { weight: "fill", className: "text-warning" }),
    info: _jsx(Info, { weight: "fill", className: "text-info" }),
    loading: (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", className: "animate-spin text-fg-brand motion-reduce:animate-none", children: [_jsx("circle", { cx: "12", cy: "12", r: "9", stroke: "currentColor", strokeOpacity: "0.2", strokeWidth: "3" }), _jsx("path", { d: "M21 12a9 9 0 0 0-9-9", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round" })] })),
};
function Toasts() {
    const t = useStrings();
    const { toasts } = BaseToast.useToastManager();
    return toasts.map((item) => (_jsx(BaseToast.Root, { toast: item, "data-orgtik-toast": item.type ?? "info", className: cn("relative rounded-overlay border border-line bg-overlay text-fg shadow-overlay", "transition-[opacity,translate] duration-(--ot-duration-slow) ease-ot-out-strong", "data-[starting-style]:-translate-y-3 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[limited]:opacity-0"), children: _jsxs(BaseToast.Content, { className: "flex items-start gap-3 p-4 pe-10", children: [_jsx("span", { "aria-hidden": "true", className: "mt-px grid size-5 shrink-0 place-items-center [&_svg]:size-5", children: ICONS[item.type ?? "info"] }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col gap-0.5", children: [_jsx(BaseToast.Title, { className: "text-body font-semibold text-fg" }), _jsx(BaseToast.Description, { className: "text-body-sm text-fg-muted" }), item.actionProps ? (_jsx(BaseToast.Action, { className: "mt-2 self-start rounded-pill text-body-sm font-semibold text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-focus" })) : null] }), _jsx(BaseToast.Close, { "aria-label": t("dismiss"), className: "absolute end-2 top-2 grid size-7 place-items-center rounded-pill text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus", children: _jsx(X, { "aria-hidden": "true", className: "size-3.5" }) })] }) }, item.id)));
}
/**
 * Render once, inside OrgtikProvider. Toasts stack at the top centre: at the bottom reading-end
 * corner they covered a dialog's footer, so its next action couldn't be pressed until they left.
 */
export function Toaster({ limit = 3 }) {
    return (_jsx(BaseToast.Provider, { toastManager: manager, limit: limit, children: _jsx(BaseToast.Portal, { children: _jsx(BaseToast.Viewport, { className: "fixed inset-x-0 top-4 z-[60] mx-auto flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2", children: _jsx(Toasts, {}) }) }) }));
}
//# sourceMappingURL=Toast.js.map