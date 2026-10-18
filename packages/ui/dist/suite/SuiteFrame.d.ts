import { type ReactNode } from "react";
import { type SuiteShellProps } from "../shell/SuiteShell.js";
import { type Crumb } from "../components/Navigation.js";
import type { SuiteOptions, SuiteSearchItem, SuiteNotification } from "./types.js";
export type SuiteFrameProps = Omit<SuiteShellProps, "rail" | "topBar" | "banner"> & SuiteOptions & {
    currentScope: string;
    currentHref?: string;
    userMenu?: ReactNode;
    breadcrumbs?: Crumb[];
    banner?: ReactNode;
    width?: "narrow" | "default" | "wide" | "full";
    onNavigate?: (href: string) => void;
    search?: {
        load: (query: string, signal: AbortSignal) => Promise<SuiteSearchItem[]>;
        onSelect: (item: SuiteSearchItem) => Promise<unknown> | void;
    };
    notifications?: {
        load: () => Promise<SuiteNotification[]>;
        onSelect: (item: SuiteNotification) => Promise<unknown> | void;
        onRead?: (id: string) => Promise<unknown>;
        onReadAll?: () => Promise<unknown>;
    };
};
export declare function SuiteFrame(props: SuiteFrameProps): import("react").JSX.Element;
//# sourceMappingURL=SuiteFrame.d.ts.map