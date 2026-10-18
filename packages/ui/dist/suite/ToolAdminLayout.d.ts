import type { ReactNode } from "react";
import type { ToolKey } from "./types.js";
export type ToolAdminSection = "overview" | "members" | "roles" | "settings" | "connections" | "import-export" | "audit" | "billing";
export declare function ToolAdminLayout({ tool, active, basePath, children, description, allow }: {
    tool: ToolKey;
    active: ToolAdminSection;
    basePath: string;
    children: ReactNode;
    description?: string;
    allow?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=ToolAdminLayout.d.ts.map