import type { ReactElement, ReactNode } from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
type Placement = {
    side?: "top" | "bottom" | "inline-start" | "inline-end";
    align?: "start" | "center" | "end";
    sideOffset?: number;
};
export declare const Popover: typeof BasePopover.Root;
/** <PopoverTrigger render={<Button variant="secondary" />}>Filters</PopoverTrigger> */
export declare const PopoverTrigger: BasePopover.Trigger;
export declare const PopoverClose: import("react").ForwardRefExoticComponent<Omit<import("@base-ui/react").PopoverCloseProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export declare function PopoverContent({ children, className, side, align, sideOffset, title, description, }: Placement & {
    children?: ReactNode;
    className?: string;
    title?: ReactNode;
    description?: ReactNode;
}): import("react").JSX.Element;
/** Put one near the app root so tooltips next to each other open without a second delay. */
export declare function TooltipProvider({ children, delay }: {
    children: ReactNode;
    delay?: number;
}): import("react").JSX.Element;
/**
 * A short hint on hover and keyboard focus. It must never hold the only way to do something or
 * the only copy of information (no hover-only actions); an IconButton's label already gives it a
 * name, so this is extra.
 */
export declare function Tooltip({ content, children, side, align }: Placement & {
    content: ReactNode;
    children: ReactElement;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=Popover.d.ts.map