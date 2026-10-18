import type { ReactNode } from "react";
type Options = {
    description?: ReactNode;
    id?: string;
    timeout?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
};
/**
 * Show a success toast only after the server answered 2xx, never optimistically: a toast that
 * says "Saved" when nothing was saved is worse than none.
 */
export declare const toast: {
    success: (title: ReactNode, options?: Options) => string;
    error: (title: ReactNode, options?: Options) => string;
    warning: (title: ReactNode, options?: Options) => string;
    info: (title: ReactNode, options?: Options) => string;
    dismiss: (id?: string) => void;
    /** Loading, then success or error, in one toast. */
    promise: <T>(p: Promise<T>, labels: {
        loading: string;
        success: string | ((v: T) => string);
        error: string | ((e: unknown) => string);
    }) => Promise<T>;
};
/**
 * Render once, inside OrgtikProvider. Toasts stack at the top centre: at the bottom reading-end
 * corner they covered a dialog's footer, so its next action couldn't be pressed until they left.
 */
export declare function Toaster({ limit }: {
    limit?: number;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=Toast.d.ts.map