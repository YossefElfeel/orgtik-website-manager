import type { DemoScene } from "./DemoPanel.js";
export type DemoRuntime = {
    apiUrl: string;
    webUrls: Record<string, string>;
    sosApiUrl: string;
};
export type DemoSearchItem = {
    id: string;
    tool: string;
    title: string;
    path: string;
    read?: boolean;
};
export type DemoBridgeTask = {
    id: string;
    title: string;
    owner: string;
    sourceApp: string;
    workspace: string;
    status: "todo";
    at: string;
};
export type DemoBridgeLead = {
    id: string;
    name: string;
    source: string;
    campaign: string;
    workspace: string;
};
export declare function demoRuntime(apiUrl?: string, webUrls?: string, sosApiUrl?: string): DemoRuntime | undefined;
export declare function demoRequest<T>(runtime: DemoRuntime, scene: DemoScene, path: string, body?: unknown): Promise<T>;
//# sourceMappingURL=connections.d.ts.map