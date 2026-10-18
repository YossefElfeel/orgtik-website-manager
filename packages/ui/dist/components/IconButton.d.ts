import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
declare const iconButton: (props?: ({
    variant?: "primary" | "secondary" | "ghost" | null | undefined;
    size?: "xs" | "sm" | "md" | "lg" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & VariantProps<typeof iconButton> & {
    /**
     * What the button does, for people who can't see the icon. Required: the Files audit found
     * 91 icon-only buttons with no name.
     */
    label: string;
    icon: ReactNode;
};
export declare const IconButton: import("react").ForwardRefExoticComponent<Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & VariantProps<(props?: ({
    variant?: "primary" | "secondary" | "ghost" | null | undefined;
    size?: "xs" | "sm" | "md" | "lg" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string> & {
    /**
     * What the button does, for people who can't see the icon. Required: the Files audit found
     * 91 icon-only buttons with no name.
     */
    label: string;
    icon: ReactNode;
} & import("react").RefAttributes<HTMLButtonElement>>;
export {};
//# sourceMappingURL=IconButton.d.ts.map