"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ArrowClockwise, LockSimple, Tray, WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";
import { Button } from "./Button.js";
import { Skeleton } from "./Display.js";
function StateFrame({ icon, title, description, action, size = "page", titleAs: Title = "p", tone = "neutral", className, role }) {
    return (_jsxs("div", { role: role, className: cn("mx-auto flex max-w-md flex-col items-center gap-3 text-center", size === "page" ? "py-16" : "py-8", className), children: [icon ? (_jsx("span", { "aria-hidden": "true", className: cn("grid place-items-center rounded-pill [&_svg]:size-[55%]", size === "page" ? "size-14" : "size-10", tone === "danger" ? "bg-danger-subtle text-danger" : "bg-brand-subtle text-fg-brand"), children: icon })) : null, _jsxs("div", { className: "flex flex-col gap-1", children: [title ? _jsx(Title, { className: cn("font-display text-fg", size === "page" ? "text-title" : "text-title-sm"), children: title }) : null, description ? _jsx("p", { className: "text-body text-fg-muted", children: description }) : null] }), action ? _jsx("div", { className: "mt-1 flex flex-wrap items-center justify-center gap-2", children: action }) : null] }));
}
export function EmptyState({ icon = _jsx(Tray, {}), title, ...props }) {
    const t = useStrings();
    return _jsx(StateFrame, { icon: icon, title: title ?? t("emptyTitle"), ...props });
}
export function ErrorState({ icon = _jsx(WarningCircle, {}), title, description, onRetry, action, ...props }) {
    const t = useStrings();
    return (_jsx(StateFrame, { role: "alert", tone: "danger", icon: icon, title: title ?? t("errorTitle"), description: description ?? t("errorBody"), action: action ??
            (onRetry ? (_jsx(Button, { variant: "secondary", startIcon: _jsx(ArrowClockwise, {}), onClick: onRetry, children: t("retry") })) : null), ...props }));
}
export function NoPermissionState({ icon = _jsx(LockSimple, {}), title, description, ...props }) {
    const t = useStrings();
    return _jsx(StateFrame, { icon: icon, title: title ?? t("noPermissionTitle"), description: description ?? t("noPermissionBody"), ...props });
}
/** Placeholder rows in the shape of a list. The region is marked busy for assistive tech. */
export function LoadingState({ rows = 5, className, label }) {
    const t = useStrings();
    return (_jsx("div", { role: "status", "aria-busy": "true", "aria-label": label ?? t("loading"), className: cn("flex flex-col gap-3 py-2", className), children: Array.from({ length: rows }, (_, i) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Skeleton, { className: "size-9 rounded-pill" }), _jsxs("div", { className: "flex flex-1 flex-col gap-2", children: [_jsx(Skeleton, { className: "h-3 w-2/5" }), _jsx(Skeleton, { className: "h-3 w-3/5" })] })] }, i))) }));
}
/**
 * Picks the right state for a list, so a screen can't forget one:
 *   <ListStates status={status} empty={{ title: "No files yet", action: <UploadButton /> }} onRetry={refetch}>
 *     <FileTable … />
 *   </ListStates>
 * `status` comes from the query: loading before the first answer, error on failure, forbidden on
 * 403, empty when the answer has no rows (and no filter is on; filtered-empty passes its own copy).
 */
export function ListStates({ status, children, empty, error, forbidden, onRetry, loadingRows, size = "page", }) {
    switch (status) {
        case "loading":
            return _jsx(LoadingState, { rows: loadingRows });
        case "error":
            return _jsx(ErrorState, { size: size, onRetry: onRetry, ...error });
        case "forbidden":
            return _jsx(NoPermissionState, { size: size, ...forbidden });
        case "empty":
            return _jsx(EmptyState, { size: size, ...empty });
        default:
            return _jsx(_Fragment, { children: children });
    }
}
//# sourceMappingURL=States.js.map