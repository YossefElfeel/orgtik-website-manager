"use client";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from "react";
import { Field as BaseField } from "@base-ui/react/field";
import { Fieldset } from "@base-ui/react/fieldset";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";
/**
 * A labelled control with help text and an error message, all wired for assistive tech by Base
 * UI's Field (the label targets the control; description and error describe it). Use `group` for a
 * set of radios or checkboxes.
 */
export function Field({ label, description, error, required, optional, group = false, className, children, invalid, ...props }) {
    const t = useStrings();
    const descriptionId = useId();
    const errorId = useId();
    const labelText = label ? (_jsxs(_Fragment, { children: [label, required ? (_jsx("span", { "aria-hidden": "true", className: "ms-0.5 text-danger", children: "*" })) : null, optional ? (_jsxs(_Fragment, { children: [" ", _jsx("span", { className: "ms-1 text-caption font-normal text-fg-subtle", children: t("optional") })] })) : null] })) : null;
    const tail = (_jsxs(_Fragment, { children: [description ? _jsx(BaseField.Description, { className: "text-caption text-fg-muted", children: description }) : null, error ? (_jsxs(BaseField.Error, { match: true, className: "flex items-start gap-1 text-caption text-danger", children: [_jsx(WarningCircle, { "aria-hidden": "true", weight: "fill", className: "mt-[0.15em] size-[1.1em] shrink-0" }), _jsx("span", { children: error })] })) : null] }));
    // A group is a fieldset, not a Base UI Field: Field gives every control inside one shared id, so
    // all the options would be named after the first one. The legend names the group; the hint and
    // the error describe it.
    if (group) {
        const describedBy = [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
        return (_jsxs(Fieldset.Root, { disabled: props.disabled, "aria-describedby": describedBy, className: cn("m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0", className), children: [labelText ? _jsx(Fieldset.Legend, { className: "mb-0.5 p-0 text-label text-fg", children: labelText }) : null, children, description ? (_jsx("p", { id: descriptionId, className: "text-caption text-fg-muted", children: description })) : null, error ? (_jsxs("p", { id: errorId, role: "alert", className: "flex items-start gap-1 text-caption text-danger", children: [_jsx(WarningCircle, { "aria-hidden": "true", weight: "fill", className: "mt-[0.15em] size-[1.1em] shrink-0" }), _jsx("span", { children: error })] })) : null] }));
    }
    return (_jsxs(BaseField.Root, { invalid: invalid ?? (error ? true : undefined), className: cn("flex flex-col gap-1.5", className), ...props, children: [labelText ? _jsx(BaseField.Label, { className: "text-label text-fg data-[disabled]:opacity-50", children: labelText }) : null, children, tail] }));
}
//# sourceMappingURL=Field.js.map