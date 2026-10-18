import type { ComponentProps, ComponentType, ReactNode } from "react";
import { type FieldPath, type FieldValues, type UseControllerProps, type ControllerRenderProps } from "react-hook-form";
import { type FieldProps } from "../components/Field.js";
type FieldChrome = Pick<FieldProps, "label" | "description" | "required" | "optional" | "className">;
export type RHFFieldProps<T extends FieldValues, N extends FieldPath<T>> = UseControllerProps<T, N> & FieldChrome & {
    render: (field: ControllerRenderProps<T, N>) => ReactNode;
    /** Turns the stored message into display text, e.g. a translate function for zod message keys. */
    formatError?: (message: string) => ReactNode;
};
/** A library Field bound to one react-hook-form field: its error, touched and dirty states flow into the Field. */
export declare function RHFField<T extends FieldValues, N extends FieldPath<T>>({ name, control, rules, defaultValue, shouldUnregister, disabled, render, formatError, ...chrome }: RHFFieldProps<T, N>): import("react").JSX.Element;
type Binding = "value" | "checked" | "select";
/**
 * Makes a form-bound version of a library control. The result takes the control's own props plus
 * `control`, `name`, `rules` and the Field chrome (label, description, required, optional).
 */
export declare function createRHFField<C extends ComponentType<any>>(Component: C, kind?: Binding): {
    <T extends FieldValues, N extends FieldPath<T>>(props: UseControllerProps<T, N> & FieldChrome & {
        formatError?: (message: string) => ReactNode;
        fieldClassName?: string;
    } & Omit<ComponentProps<C>, "defaultValue" | "onChange" | "value" | "name" | "checked" | "onValueChange" | "onCheckedChange">): import("react").JSX.Element;
    displayName: string;
};
export {};
//# sourceMappingURL=index.d.ts.map