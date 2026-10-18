import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
export declare const buttonVariants: (props?: ({
    variant?: "warning" | "danger" | "link" | "primary" | "secondary" | "ghost" | "brand" | null | undefined;
    size?: "xs" | "sm" | "md" | "lg" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & {
    /** Shows a spinner, marks the button busy and blocks presses until the work ends. */
    shape?: "pill" | "control";
    loading?: boolean;
    /** An icon before the label (at the reading start). */
    startIcon?: ReactNode;
    /** An icon after the label. The brand variant brings its own arrow chip instead. */
    endIcon?: ReactNode;
};
export declare const Button: import("react").ForwardRefExoticComponent<ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<(props?: ({
    variant?: "warning" | "danger" | "link" | "primary" | "secondary" | "ghost" | "brand" | null | undefined;
    size?: "xs" | "sm" | "md" | "lg" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string> & {
    /** Shows a spinner, marks the button busy and blocks presses until the work ends. */
    shape?: "pill" | "control";
    loading?: boolean;
    /** An icon before the label (at the reading start). */
    startIcon?: ReactNode;
    /** An icon after the label. The brand variant brings its own arrow chip instead. */
    endIcon?: ReactNode;
} & import("react").RefAttributes<HTMLButtonElement>>;
//# sourceMappingURL=Button.d.ts.map