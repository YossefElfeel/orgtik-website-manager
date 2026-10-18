import React, { type ReactNode } from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import type { VariantProps } from "class-variance-authority";
import { controlFrame } from "../lib/control.js";
export type InputProps = Omit<BaseInput.Props, "size" | "className" | "render"> & VariantProps<typeof controlFrame> & {
    className?: string;
    /** An icon at the reading start, e.g. a magnifier in a search box. */
    startIcon?: ReactNode;
    /** Something at the reading end: a unit, a clear button, the password toggle. */
    endSlot?: ReactNode;
};
export declare const Input: React.ForwardRefExoticComponent<Omit<InputProps, "ref"> & React.RefAttributes<HTMLInputElement>>;
export type PasswordInputProps = Omit<InputProps, "type" | "endSlot">;
/** A password input with a show/hide toggle. The toggle is a real button with a spoken label. */
export declare const PasswordInput: React.ForwardRefExoticComponent<Omit<PasswordInputProps, "ref"> & React.RefAttributes<HTMLInputElement>>;
export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
    className?: string;
    /** Grow with the text up to this many rows (CSS field-sizing), then scroll. */
    maxRows?: number;
};
/** Multi-line text. It grows with its content where the browser supports field-sizing. */
export declare const Textarea: React.ForwardRefExoticComponent<Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
    className?: string;
    /** Grow with the text up to this many rows (CSS field-sizing), then scroll. */
    maxRows?: number;
} & React.RefAttributes<HTMLTextAreaElement>>;
//# sourceMappingURL=Input.d.ts.map