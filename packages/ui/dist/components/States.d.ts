import type { ReactNode } from "react";
type StateProps = {
    title?: ReactNode;
    description?: ReactNode;
    /** The way forward: "Upload a file", "Ask for access". An empty state without one is a dead end. */
    action?: ReactNode;
    icon?: ReactNode;
    /** compact fits inside a card or table; page fills the content area. */
    size?: "compact" | "page";
    /**
     * The title's element. A state inside a page is a paragraph under the page's own heading (the
     * default); a state that IS the page (404, no access, a crash) passes "h1", so the page has one.
     */
    titleAs?: "p" | "h1" | "h2" | "h3";
    className?: string;
};
export declare function EmptyState({ icon, title, ...props }: StateProps): import("react").JSX.Element;
export declare function ErrorState({ icon, title, description, onRetry, action, ...props }: StateProps & {
    onRetry?: () => void;
}): import("react").JSX.Element;
export declare function NoPermissionState({ icon, title, description, ...props }: StateProps): import("react").JSX.Element;
/** Placeholder rows in the shape of a list. The region is marked busy for assistive tech. */
export declare function LoadingState({ rows, className, label }: {
    rows?: number;
    className?: string;
    label?: string;
}): import("react").JSX.Element;
export type ListStatus = "loading" | "error" | "forbidden" | "empty" | "ready";
/**
 * Picks the right state for a list, so a screen can't forget one:
 *   <ListStates status={status} empty={{ title: "No files yet", action: <UploadButton /> }} onRetry={refetch}>
 *     <FileTable … />
 *   </ListStates>
 * `status` comes from the query: loading before the first answer, error on failure, forbidden on
 * 403, empty when the answer has no rows (and no filter is on; filtered-empty passes its own copy).
 */
export declare function ListStates({ status, children, empty, error, forbidden, onRetry, loadingRows, size, }: {
    status: ListStatus;
    children: ReactNode;
    empty: StateProps;
    error?: StateProps;
    forbidden?: StateProps;
    onRetry?: () => void;
    loadingRows?: number;
    size?: StateProps["size"];
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=States.d.ts.map