import type { SuiteNotification } from "../suite/types.js";
export declare function NotificationCenter({ items, load, onRead, onReadAll, onSelect }: {
    items?: SuiteNotification[];
    load?: () => Promise<SuiteNotification[]>;
    onRead?: (id: string) => Promise<unknown>;
    onReadAll?: () => Promise<unknown>;
    onSelect: (item: SuiteNotification) => Promise<unknown> | void;
}): import("react").JSX.Element;
//# sourceMappingURL=NotificationCenter.d.ts.map