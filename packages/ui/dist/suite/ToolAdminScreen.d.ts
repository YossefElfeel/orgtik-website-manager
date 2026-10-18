import { type ReactNode } from "react";
import { type ToolAdminSection } from "./ToolAdminLayout.js";
import type { ToolKey } from "./types.js";
/** Shared current-tool controls; domain-specific import and settings stay in the owning app. */
export declare function ToolAdminScreen({ tool, active, basePath, children }: {
    tool: ToolKey;
    active?: ToolAdminSection;
    basePath?: string;
    children?: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=ToolAdminScreen.d.ts.map