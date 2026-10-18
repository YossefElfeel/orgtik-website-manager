"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useRef, useState } from "react";
import { File as FileIcon, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useFormatter, useStrings } from "../provider/OrgtikProvider.js";
import { MediaFilePreview } from "./MediaFilePreview.js";
const matches = (file, accept) => {
    if (!accept)
        return true;
    return accept.split(",").some((raw) => {
        const rule = raw.trim().toLowerCase();
        if (rule.startsWith("."))
            return file.name.toLowerCase().endsWith(rule);
        if (rule.endsWith("/*"))
            return file.type.startsWith(rule.slice(0, -1));
        return file.type === rule;
    });
};
/**
 * Choose files by dropping them or with a real file input (a keyboard and screen-reader path,
 * not a click-only drop zone). Refused files are named with the reason, not dropped silently.
 */
export function FileField({ label, value, onChange, accept, maxSize, multiple = true, maxFiles, description, disabled, className }) {
    const t = useStrings();
    const f = useFormatter();
    const id = useId();
    const input = useRef(null);
    const [over, setOver] = useState(false);
    const [refused, setRefused] = useState([]);
    const take = (list) => {
        const incoming = Array.from(list);
        const reasons = [];
        const ok = incoming.filter((file) => {
            if (!matches(file, accept))
                return reasons.push(t("fileTypeRefused", { name: file.name })), false;
            if (maxSize && file.size > maxSize)
                return reasons.push(t("fileTooLarge", { name: file.name, max: f.bytes(maxSize) })), false;
            return true;
        });
        let next = multiple ? [...value, ...ok] : ok.slice(0, 1);
        if (maxFiles && next.length > maxFiles) {
            reasons.push(t("tooManyFiles", { max: maxFiles }));
            next = next.slice(0, maxFiles);
        }
        setRefused(reasons);
        onChange(next);
    };
    const onDrop = (e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled)
            take(e.dataTransfer.files);
    };
    return (_jsxs("div", { className: cn("flex flex-col gap-2", className), children: [_jsx("label", { htmlFor: id, className: "text-label text-fg", children: label }), _jsxs("div", { onDragOver: (e) => {
                    e.preventDefault();
                    if (!disabled)
                        setOver(true);
                }, onDragLeave: () => setOver(false), onDrop: onDrop, className: cn("flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-control bg-raised px-6 py-8 text-center transition-colors", over && "border-action-primary bg-brand-subtle", disabled && "opacity-50"), children: [_jsx(UploadSimple, { "aria-hidden": "true", className: "size-6 text-fg-brand" }), _jsxs("p", { className: "text-body text-fg", children: [t("dropFiles"), " ", _jsx("button", { type: "button", disabled: disabled, onClick: () => input.current?.click(), className: "rounded-sm font-semibold text-fg-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus", children: t("chooseFiles") })] }), description ? _jsx("p", { className: "text-caption text-fg-muted", children: description }) : null, _jsx("input", { ref: input, id: id, type: "file", accept: accept, multiple: multiple, disabled: disabled, className: "sr-only", onChange: (e) => {
                            if (e.target.files)
                                take(e.target.files);
                            e.target.value = "";
                        } })] }), refused.length ? (_jsx("ul", { role: "alert", className: "flex flex-col gap-1 text-caption text-danger", children: refused.map((r, i) => (_jsxs("li", { className: "flex items-start gap-1", children: [_jsx(WarningCircle, { "aria-hidden": "true", weight: "fill", className: "mt-[0.15em] size-[1.1em] shrink-0" }), _jsx("span", { dir: "auto", children: r })] }, i))) })) : null, value.length ? (_jsx("ul", { className: "flex flex-col divide-y divide-line rounded-card border border-line bg-raised", children: value.map((file, i) => (_jsxs("li", { className: "flex items-center gap-3 px-3 py-2", children: [/^(image|video)\//.test(file.type) ? _jsx(MediaFilePreview, { file: file }) : _jsx(FileIcon, { "aria-hidden": "true", className: "size-5 shrink-0 text-fg-subtle" }), _jsx("span", { dir: "auto", className: "min-w-0 flex-1 truncate text-body text-fg", children: file.name }), _jsx("span", { className: "text-caption text-fg-muted tabular-nums", children: f.bytes(file.size) }), _jsx("button", { type: "button", disabled: disabled, onClick: () => onChange(value.filter((_, j) => j !== i)), "aria-label": t("removeItem", { label: file.name }), className: "grid size-7 shrink-0 place-items-center rounded-pill text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-40", children: _jsx(X, { "aria-hidden": "true", className: "size-3.5" }) })] }, `${file.name}-${i}`))) })) : null] }));
}
//# sourceMappingURL=FileField.js.map