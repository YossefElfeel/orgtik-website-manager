import type { SuiteSearchItem } from "../suite/types.js";
export declare function CommandPalette({ items, load, onSelect }: {
    items?: SuiteSearchItem[];
    load?: (query: string, signal: AbortSignal) => Promise<SuiteSearchItem[]>;
    onSelect: (item: SuiteSearchItem) => Promise<unknown> | void;
}): import("react").JSX.Element;
//# sourceMappingURL=CommandPalette.d.ts.map