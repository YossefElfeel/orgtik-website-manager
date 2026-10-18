import type { ReactNode } from "react";
export type AccordionItem = {
    value: string;
    title: ReactNode;
    content: ReactNode;
    disabled?: boolean;
};
/** Sections that open in place. `multiple` lets several stay open; FAQs and settings groups use it. */
export declare function Accordion({ items, multiple, defaultValue, className }: {
    items: AccordionItem[];
    multiple?: boolean;
    defaultValue?: string[];
    className?: string;
}): import("react").JSX.Element;
export declare const Collapsible: import("react").ForwardRefExoticComponent<Omit<import("@base-ui/react").CollapsibleRootProps, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
/** <CollapsibleTrigger render={<Button variant="ghost" />}>Advanced</CollapsibleTrigger> */
export declare const CollapsibleTrigger: import("react").ForwardRefExoticComponent<Omit<import("@base-ui/react").CollapsibleTriggerProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export declare function CollapsiblePanel({ children, className }: {
    children: ReactNode;
    className?: string;
}): import("react").JSX.Element;
export declare function Separator({ orientation, className }: {
    orientation?: "horizontal" | "vertical";
    className?: string;
}): import("react").JSX.Element;
/**
 * A scrolling region with slim scrollbars that match the theme. The viewport is focusable, so
 * keyboard users can scroll it (axe: scrollable-region-focusable).
 */
export declare function ScrollArea({ children, className, label }: {
    children: ReactNode;
    className?: string;
    label?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=Disclosure.d.ts.map