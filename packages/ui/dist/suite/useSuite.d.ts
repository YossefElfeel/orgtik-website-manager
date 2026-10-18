import type { ConnectionState, SuiteProviderProps, SuiteSnapshot, ToolKey } from "./types.js";
export declare function SuiteProvider({ children, ...options }: SuiteProviderProps): import("react").JSX.Element;
export declare function connectionState(snapshot: SuiteSnapshot | null, source: ToolKey | undefined, target: ToolKey, write?: boolean, targetWrite?: boolean): ConnectionState;
export declare function useSuite(): {
    snapshot: SuiteSnapshot | null;
    session: import("../auth/types.js").AuthEnvelope<import("../auth/types.js").SessionPerson> | null;
    request: <T>(path: string, method?: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<T>;
    mutate: <T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<T>;
    toolState: (tool: ToolKey) => {
        scope: string;
        roles: string[];
        access: import("../auth/types.js").AccessState;
        canWrite: boolean;
        reason?: string;
        seats: {
            capacity: number | null;
            assigned: number;
            reserved: number;
            available: number | null;
        };
    } | undefined;
    hasTool: (tool: ToolKey) => boolean;
    accessibleTools: ToolKey[];
    isOwner: boolean;
    canAdmin: (tool: ToolKey) => boolean;
    loading: boolean;
    seat: (tool: ToolKey) => {
        capacity: number | null;
        assigned: number;
        reserved: number;
        available: number | null;
    } | undefined;
    connectionState: (target: ToolKey, source?: ToolKey | undefined, write?: boolean, targetWrite?: boolean) => ConnectionState;
    canConnect: (source: ToolKey, target: ToolKey) => boolean;
    apiUrl?: string;
    sosUrl?: string;
    currentTool?: ToolKey;
    error?: string;
    refresh?: () => Promise<void>;
};
//# sourceMappingURL=useSuite.d.ts.map