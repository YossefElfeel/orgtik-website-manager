export declare class SuiteRequestError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string);
}
export declare const suiteApiRoot: (base: string) => string;
export declare function suiteRequest<T>(base: string, path: string, options?: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
    keepalive?: boolean;
}): Promise<T>;
//# sourceMappingURL=api.d.ts.map