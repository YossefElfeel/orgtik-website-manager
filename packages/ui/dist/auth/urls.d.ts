/** Next applies basePath to Link/router; browser APIs and public assets need it explicitly. */
export declare function appPath(path: string): string;
export declare function appRelativePath(path: string): string;
/** Keep the app prefix when constructing a cross-service destination. */
export declare function appUrl(base: string, path: string): URL;
/** A same-origin service is identified by its path as well as its hostname. */
export declare function pathInApp(url: URL, domain: string): string | null;
//# sourceMappingURL=urls.d.ts.map