import type { HTMLAttributes, ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
import { type StatusEntity, type StatusState } from "../status/matrix.js";
export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger";
export declare const badgeVariants: (props?: ({
    tone?: "success" | "warning" | "danger" | "info" | "brand" | "neutral" | null | undefined;
    emphasis?: "solid" | "outline" | "subtle" | null | undefined;
    size?: "sm" | "md" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & {
    icon?: ReactNode;
    dot?: boolean;
};
/** A short label. Colour is never the only signal: pair a tone with words, and an icon for status. */
export declare function Badge({ className, tone, emphasis, size, icon, dot, children, ...props }: BadgeProps): import("react").JSX.Element;
export type StatusBadgeProps<E extends StatusEntity> = Omit<BadgeProps, "tone" | "icon" | "children"> & {
    entity: E;
    state: StatusState<E>;
    /**
     * Who is looking. Some states read differently to customers (D-027): a service request
     * "quoted" is "Quote to review" for the customer. Default: staff.
     */
    viewer?: "staff" | "customer";
    /** Extra words after the label, e.g. the days left: "Trial · 5 days". */
    detail?: ReactNode;
};
/**
 * A status's label as text, in the current language, for places a badge doesn't fit (tabs,
 * filters, a select's options). Same table as StatusBadge.
 */
export declare function useStatusLabel(): <E extends StatusEntity>(entity: E, state: StatusState<E>, viewer?: "staff" | "customer") => string;
/**
 * A status, from the unified status matrix: the label in the current language, the tone and the
 * icon all come from one table, so "Active" looks and reads the same in every app.
 */
export declare function StatusBadge<E extends StatusEntity>({ entity, state, viewer, detail, ...props }: StatusBadgeProps<E>): import("react").JSX.Element;
//# sourceMappingURL=Badge.d.ts.map