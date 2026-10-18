import type { ReactNode } from "react";
export declare const Tabs: import("react").ForwardRefExoticComponent<Omit<import("@base-ui/react").TabsRootProps, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export declare const TabsPanel: import("react").ForwardRefExoticComponent<Omit<import("@base-ui/react").TabsPanelProps, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export type TabItem = {
    value: string;
    label: ReactNode;
    count?: number;
    disabled?: boolean;
};
/**
 * The tab row. `line` sits on a page (an underline marks the current tab); `contained` sits
 * inside a card or toolbar; `side` is a column beside the panel, for more tabs than fit in a row
 * (put `orientation="vertical"` on <Tabs> so the arrow keys go up and down). Arrow keys follow the
 * reading direction (spike-verified).
 */
export declare function TabsList({ items, variant, className }: {
    items: TabItem[];
    variant?: "line" | "contained" | "side";
    className?: string;
}): import("react").JSX.Element;
/** Page numbers to show: always the first and last, the current and its neighbours, gaps as null. */
export declare function pageWindow(page: number, pages: number): Array<number | null>;
export type PaginationProps = {
    /** 1-based. */
    page: number;
    pageSize: number;
    total: number;
    onPageChange?: (page: number) => void;
    /** Shows the rows-per-page choice (10 by default). */
    onPageSizeChange?: (size: number) => void;
    pageSizes?: number[];
    /** For URL-synced lists: pages render as real links, so they can be opened and shared. */
    hrefFor?: (page: number) => string;
    className?: string;
};
export declare function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizes, hrefFor, className }: PaginationProps): import("react").JSX.Element;
export type Crumb = {
    label: ReactNode;
    href?: string;
};
/** Where this page sits. The last crumb is the current page; the rest link up. */
export declare function Breadcrumb({ items, className }: {
    items: Crumb[];
    className?: string;
}): import("react").JSX.Element;
export type PageHeaderProps = {
    title: ReactNode;
    description?: ReactNode;
    breadcrumb?: Crumb[];
    /** A StatusBadge or similar, next to the title. */
    status?: ReactNode;
    meta?: ReactNode;
    tabs?: ReactNode;
    /** The page's actions. Put the primary one last, so it sits at the reading end. */
    actions?: ReactNode;
    className?: string;
};
export declare function PageHeader({ title, description, breadcrumb, status, meta, tabs, actions, className }: PageHeaderProps): import("react").JSX.Element;
//# sourceMappingURL=Navigation.d.ts.map