import type { AuthEnvelope, ScopeGrant, StaffAccess, ToolAccess, ToolKey, WorkspaceContext } from "./types.js";
export declare const TOOL_SCOPES: Record<ToolKey, string>;
/** Navigation metadata never supplies the active tool's authorization context. */
export declare function staffToolLaunch(session: AuthEnvelope | null | undefined): StaffAccess["toolLaunch"];
export declare function toolAccess(context: WorkspaceContext | null | undefined, key: ToolKey, fallback?: unknown): ToolAccess;
export declare function scopesFromContext(context: WorkspaceContext | null): ScopeGrant[];
//# sourceMappingURL=access.d.ts.map