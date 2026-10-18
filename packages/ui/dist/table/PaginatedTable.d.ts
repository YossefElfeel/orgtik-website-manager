import { type ReactElement, type ReactNode } from "react";
type TablePart = ReactElement<{
    children?: ReactNode;
    className?: string;
}>;
/** Keeps specialized invoice, pricing, and import tables while applying suite table defaults. */
export declare function PaginatedTable({ children, resetKey, }: {
    children: TablePart;
    resetKey?: string | number;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=PaginatedTable.d.ts.map