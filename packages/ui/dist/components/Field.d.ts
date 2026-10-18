import { type ReactNode } from "react";
import { Field as BaseField } from "@base-ui/react/field";
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
export declare function Field({ label, description, error, required, optional, group, className, children, invalid, ...props }: FieldProps): import("react").JSX.Element;
//# sourceMappingURL=Field.d.ts.map