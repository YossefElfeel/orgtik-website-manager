"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useController } from "react-hook-form";
import { Field } from "../components/Field.js";
/** A library Field bound to one react-hook-form field: its error, touched and dirty states flow into the Field. */
export function RHFField({ name, control, rules, defaultValue, shouldUnregister, disabled, render, formatError, ...chrome }) {
    const { field, fieldState } = useController({ name, control, rules, defaultValue, shouldUnregister, disabled });
    const message = fieldState.error?.message;
    return (_jsx(Field, { name: name, touched: fieldState.isTouched, dirty: fieldState.isDirty, disabled: field.disabled, error: message ? (formatError ? formatError(message) : message) : undefined, ...chrome, children: render(field) }));
}
const bind = (kind, field) => {
    const common = { name: field.name, ref: field.ref, onBlur: field.onBlur, disabled: field.disabled };
    if (kind === "checked")
        return { ...common, checked: Boolean(field.value), onCheckedChange: (v) => field.onChange(v) };
    if (kind === "select")
        return { ...common, value: field.value ?? null, onValueChange: (v) => field.onChange(v) };
    return { ...common, value: field.value ?? "", onChange: field.onChange };
};
/**
 * Makes a form-bound version of a library control. The result takes the control's own props plus
 * `control`, `name`, `rules` and the Field chrome (label, description, required, optional).
 */
export function createRHFField(Component, kind = "value") {
    function Bound(props) {
        const { name, control, rules, defaultValue, shouldUnregister, disabled, label, description, required, optional, formatError, fieldClassName, ...own } = props;
        // A checkbox or switch carries its label beside it, so the Field adds only the error.
        const inline = kind === "checked";
        return (_jsx(RHFField, { name, control, rules, defaultValue, shouldUnregister, disabled, required, optional, formatError, label: inline ? undefined : label, description: inline ? undefined : description, className: fieldClassName, render: (field) => (_jsx(Component, { ...own, ...(inline ? { label, description } : null), required: required, ...bind(kind, field) })) }));
    }
    Bound.displayName = `RHF(${Component.displayName ?? Component.name ?? "Control"})`;
    return Bound;
}
//# sourceMappingURL=index.js.map