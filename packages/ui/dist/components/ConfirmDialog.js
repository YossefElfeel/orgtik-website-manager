"use client";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { scrim } from "../lib/overlay.js";
import { useStrings } from "../provider/OrgtikProvider.js";
import { Button } from "./Button.js";
import { Checkbox } from "./Checkbox.js";
import { Input } from "./Input.js";
export function ConfirmDialog({ open, defaultOpen, onOpenChange, trigger, title, impact, confirmLabel, cancelLabel, tone = "danger", irreversible = false, reason, acknowledgement, typeToConfirm, onConfirm, }) {
    const t = useStrings();
    const [innerOpen, setInnerOpen] = useState(defaultOpen ?? false);
    const isOpen = open ?? innerOpen;
    const [pending, setPending] = useState(false);
    const [failed, setFailed] = useState(false);
    const [reasonText, setReasonText] = useState("");
    const [acked, setAcked] = useState(false);
    const [typed, setTyped] = useState("");
    const reasonId = useId();
    const typedId = useId();
    const setOpen = (next) => {
        if (pending)
            return;
        if (!next) {
            setFailed(false);
            setReasonText("");
            setAcked(false);
            setTyped("");
        }
        setInnerOpen(next);
        onOpenChange?.(next);
    };
    const ready = !pending &&
        (!reason?.required || reasonText.trim().length > 0) &&
        (!acknowledgement || acked) &&
        (!typeToConfirm || typed.trim() === typeToConfirm);
    const confirm = async () => {
        if (!ready)
            return;
        setFailed(false);
        const result = onConfirm({ reason: reasonText.trim() });
        if (result && typeof result.then === "function") {
            setPending(true);
            try {
                await result;
                setPending(false);
                setOpen(false);
            }
            catch {
                setPending(false);
                setFailed(true);
            }
        }
        else {
            setOpen(false);
        }
    };
    return (_jsxs(AlertDialog.Root, { open: isOpen, onOpenChange: (next) => setOpen(next), children: [trigger ? _jsx(AlertDialog.Trigger, { render: trigger }) : null, _jsxs(AlertDialog.Portal, { children: [_jsx(AlertDialog.Backdrop, { className: scrim }), _jsxs(AlertDialog.Popup, { className: cn("fixed start-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-[440px] -translate-y-1/2 flex-col gap-5 p-6", "ltr:-translate-x-1/2 rtl:translate-x-1/2", "rounded-panel border border-line bg-overlay text-fg shadow-overlay outline-none", "transition-[opacity,scale] duration-(--ot-duration-base) ease-ot-out-strong", "data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0"), children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(AlertDialog.Title, { className: "font-display text-title text-fg", children: title }), _jsxs(AlertDialog.Description, { className: "text-body text-fg-muted", children: [impact, irreversible ? _jsxs(_Fragment, { children: [" ", t("cannotBeUndone")] }) : null] })] }), reason || acknowledgement || typeToConfirm ? (_jsxs("div", { className: "flex flex-col gap-4", children: [reason ? (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsxs("label", { htmlFor: reasonId, className: "text-label text-fg", children: [reason.label, reason.required ? (_jsx("span", { "aria-hidden": "true", className: "ms-0.5 text-danger", children: "*" })) : null] }), _jsx("textarea", { id: reasonId, value: reasonText, onChange: (e) => setReasonText(e.target.value), placeholder: reason.placeholder, required: reason.required, rows: 3, className: "min-h-20 w-full resize-y rounded-field border border-line-control bg-raised px-3 py-2 text-body text-fg outline-hidden placeholder:text-fg-subtle hover:border-fg-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus" })] })) : null, typeToConfirm ? (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { htmlFor: typedId, className: "text-label text-fg", children: t("typeToConfirm", { word: typeToConfirm }) }), _jsx(Input, { id: typedId, value: typed, onChange: (e) => setTyped(e.target.value), autoComplete: "off", spellCheck: false, dir: "auto" })] })) : null, acknowledgement ? _jsx(Checkbox, { label: acknowledgement, checked: acked, onCheckedChange: (v) => setAcked(v) }) : null] })) : null, failed ? (_jsxs("p", { role: "alert", className: "flex items-start gap-2 rounded-field bg-danger-subtle px-3 py-2 text-body-sm text-danger", children: [_jsx(WarningCircle, { "aria-hidden": "true", weight: "fill", className: "mt-[0.15em] size-[1.1em] shrink-0" }), t("actionFailed")] })) : null, _jsxs("div", { className: "flex flex-wrap items-center justify-end gap-2", children: [_jsx(AlertDialog.Close, { render: _jsx(Button, { variant: "secondary", disabled: pending }), children: cancelLabel ?? t("cancel") }), _jsx(Button, { variant: tone, loading: pending, disabled: !ready && !pending, onClick: confirm, children: confirmLabel })] })] })] })] }));
}
//# sourceMappingURL=ConfirmDialog.js.map