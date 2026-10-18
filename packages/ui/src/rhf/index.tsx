"use client";
// react-hook-form adapters, in their own entry (`@orgtik/ui/rhf`) so apps without RHF never load it.
//
//   <RHFField control={control} name="email" label="Email" render={(f) => <Input type="email" {...f} />} />
//
//   const FormInput = createRHFField(Input);            // value + onChange (text controls)
//   const FormSwitch = createRHFField(Switch, "checked"); // checked + onCheckedChange
//   const FormSelect = createRHFField(Select, "select");  // value + onValueChange
//   <FormInput control={control} name="email" label="Email" type="email" />
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { useController, type FieldPath, type FieldValues, type UseControllerProps, type ControllerRenderProps } from "react-hook-form";
import { Field, type FieldProps } from "../components/Field.js";

type FieldChrome = Pick<FieldProps, "label" | "description" | "required" | "optional" | "className">;

export type RHFFieldProps<T extends FieldValues, N extends FieldPath<T>> = UseControllerProps<T, N> &
  FieldChrome & {
    render: (field: ControllerRenderProps<T, N>) => ReactNode;
    /** Turns the stored message into display text, e.g. a translate function for zod message keys. */
    formatError?: (message: string) => ReactNode;
  };

/** A library Field bound to one react-hook-form field: its error, touched and dirty states flow into the Field. */
export function RHFField<T extends FieldValues, N extends FieldPath<T>>({
  name,
  control,
  rules,
  defaultValue,
  shouldUnregister,
  disabled,
  render,
  formatError,
  ...chrome
}: RHFFieldProps<T, N>) {
  const { field, fieldState } = useController({ name, control, rules, defaultValue, shouldUnregister, disabled });
  const message = fieldState.error?.message;
  return (
    <Field
      name={name}
      touched={fieldState.isTouched}
      dirty={fieldState.isDirty}
      disabled={field.disabled}
      error={message ? (formatError ? formatError(message) : message) : undefined}
      {...chrome}
    >
      {render(field)}
    </Field>
  );
}

type Binding = "value" | "checked" | "select";

const bind = (kind: Binding, field: ControllerRenderProps<FieldValues, string>) => {
  const common = { name: field.name, ref: field.ref, onBlur: field.onBlur, disabled: field.disabled };
  if (kind === "checked") return { ...common, checked: Boolean(field.value), onCheckedChange: (v: boolean) => field.onChange(v) };
  if (kind === "select") return { ...common, value: field.value ?? null, onValueChange: (v: unknown) => field.onChange(v) };
  return { ...common, value: field.value ?? "", onChange: field.onChange };
};

/**
 * Makes a form-bound version of a library control. The result takes the control's own props plus
 * `control`, `name`, `rules` and the Field chrome (label, description, required, optional).
 */
export function createRHFField<C extends ComponentType<any>>(Component: C, kind: Binding = "value") {
  type Own = Omit<ComponentProps<C>, "name" | "value" | "defaultValue" | "onChange" | "checked" | "onCheckedChange" | "onValueChange">;
  function Bound<T extends FieldValues, N extends FieldPath<T>>(
    props: UseControllerProps<T, N> & FieldChrome & { formatError?: (message: string) => ReactNode; fieldClassName?: string } & Own,
  ) {
    const { name, control, rules, defaultValue, shouldUnregister, disabled, label, description, required, optional, formatError, fieldClassName, ...own } =
      props as any;
    // A checkbox or switch carries its label beside it, so the Field adds only the error.
    const inline = kind === "checked";
    return (
      <RHFField
        {...{ name, control, rules, defaultValue, shouldUnregister, disabled, required, optional, formatError }}
        label={inline ? undefined : label}
        description={inline ? undefined : description}
        className={fieldClassName}
        render={(field) => (
          <Component
            {...own}
            {...(inline ? { label, description } : null)}
            required={required}
            {...bind(kind, field as ControllerRenderProps<FieldValues, string>)}
          />
        )}
      />
    );
  }
  Bound.displayName = `RHF(${Component.displayName ?? Component.name ?? "Control"})`;
  return Bound;
}
