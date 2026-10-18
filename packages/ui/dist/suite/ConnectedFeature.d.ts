import { type ReactNode } from "react";
import type { ToolKey } from "./types.js";
export type ConnectedFeatureProps = {
    requires: ToolKey;
    source?: ToolKey;
    children: ReactNode;
    write?: boolean;
    targetWrite?: boolean;
    title?: string;
    compact?: boolean;
    onTrial?: () => Promise<unknown> | void;
    onRequestAccess?: () => Promise<unknown> | void;
    onRequestTool?: () => Promise<unknown> | void;
    billingHref?: string;
    settingsHref?: string;
};
export declare function ConnectedFeature({ requires, source, children, write, targetWrite, title, compact, onTrial, onRequestAccess, onRequestTool, billingHref, settingsHref }: ConnectedFeatureProps): import("react").JSX.Element;
//# sourceMappingURL=ConnectedFeature.d.ts.map