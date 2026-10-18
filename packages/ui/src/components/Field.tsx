"use client";
import { useId, type ReactNode } from "react";
import { Field as BaseField } from "@base-ui/react/field";
import { Fieldset } from "@base-ui/react/fieldset";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";

export type FieldProps = Omit<BaseField.Root.Props, "className" | "children" | "render"> & {
  label?: ReactNode;
  /** Help text under the control. It stays visible when there is an error. */
  description?: ReactNode;
  /** The message to show; setting it marks the control invalid and links it with aria-describedby. */
  error?: ReactNode;
  /** Marks the label with an asterisk. Pass `required` to the control too, for the browser. */
  required?: boolean;
  /** Says "Optional" after the label, for forms where most fields are required. */
  optional?: boolean;
  /**
   * For a set of controls (a RadioGroup, a list of checkboxes): the label becomes the legend of a
   * fieldset, which names the group, and each option keeps its own label. Without it, Field labels
   * every control inside with the field's label, so all radios would be called the same.
   */
  group?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * A labelled control with help text and an error message, all wired for assistive tech by Base
 * UI's Field (the label targets the control; description and error describe it). Use `group` for a
 * set of radios or checkboxes.
 */
export function Field({ label, description, error, required, optional, group = false, className, children, invalid, ...props }: FieldProps) {
  const t = useStrings();
  const descriptionId = useId();
  const errorId = useId();
  const labelText = label ? (
    <>
      {label}
      {required ? (
        <span aria-hidden="true" className="ms-0.5 text-danger">
          *
        </span>
      ) : null}
      {optional ? (
        <>
          {/* A real space, so the name reads "Labels Optional", not "LabelsOptional". */}{" "}
          <span className="ms-1 text-caption font-normal text-fg-subtle">{t("optional")}</span>
        </>
      ) : null}
    </>
  ) : null;
  const tail = (
    <>
      {description ? <BaseField.Description className="text-caption text-fg-muted">{description}</BaseField.Description> : null}
      {error ? (
        <BaseField.Error match className="flex items-start gap-1 text-caption text-danger">
          <WarningCircle aria-hidden="true" weight="fill" className="mt-[0.15em] size-[1.1em] shrink-0" />
          <span>{error}</span>
        </BaseField.Error>
      ) : null}
    </>
  );

  // A group is a fieldset, not a Base UI Field: Field gives every control inside one shared id, so
  // all the options would be named after the first one. The legend names the group; the hint and
  // the error describe it.
  if (group) {
    const describedBy = [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
    return (
      <Fieldset.Root
        disabled={props.disabled}
        aria-describedby={describedBy}
        className={cn("m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0", className)}
      >
        {labelText ? <Fieldset.Legend className="mb-0.5 p-0 text-label text-fg">{labelText}</Fieldset.Legend> : null}
        {children}
        {description ? (
          <p id={descriptionId} className="text-caption text-fg-muted">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="flex items-start gap-1 text-caption text-danger">
            <WarningCircle aria-hidden="true" weight="fill" className="mt-[0.15em] size-[1.1em] shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </Fieldset.Root>
    );
  }

  return (
    <BaseField.Root invalid={invalid ?? (error ? true : undefined)} className={cn("flex flex-col gap-1.5", className)} {...props}>
      {labelText ? <BaseField.Label className="text-label text-fg data-[disabled]:opacity-50">{labelText}</BaseField.Label> : null}
      {children}
      {tail}
    </BaseField.Root>
  );
}
