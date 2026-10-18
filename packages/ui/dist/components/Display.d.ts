import type { HTMLAttributes, ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
declare const avatar: (props?: ({
    size?: "xs" | "sm" | "md" | "lg" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
/**
 * Up to two initials from a name. Arabic letters would join into one shape ("هس"), so they are
 * kept apart with a zero-width non-joiner.
 */
export declare function initials(name: string): string;
export type AvatarProps = VariantProps<typeof avatar> & {
    /** The person's name: the image's alt text and the source of the initials. */
    name: string;
    src?: string | null;
    className?: string;
    /** Hide from assistive tech when the name is already written next to it. */
    decorative?: boolean;
};
export declare function Avatar({ name, src, size, className, decorative }: AvatarProps): import("react").JSX.Element;
declare const card: (props?: ({
    padding?: "none" | "sm" | "md" | "lg" | null | undefined;
    elevation?: "raised" | "flat" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export type CardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof card>;
/** A container for one object or one summary. Not a wrapper for every block on a page. */
export declare function Card({ className, padding, elevation, ...props }: CardProps): import("react").JSX.Element;
export declare function CardHeader({ title, description, actions, className }: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}): import("react").JSX.Element;
/** A placeholder with the shape of the content that is loading. The region should carry aria-busy. */
export declare function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
declare const spinner: (props?: ({
    size?: "sm" | "md" | "lg" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
/**
 * A busy indicator. With `label` it announces itself (role="status"); without one it's
 * decorative, for use inside something that already says it's busy (a Button's `loading`).
 */
export declare function Spinner({ size, className, label }: VariantProps<typeof spinner> & {
    className?: string;
    label?: string | true;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=Display.d.ts.map