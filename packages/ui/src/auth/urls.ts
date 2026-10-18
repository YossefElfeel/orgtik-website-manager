declare const process: { env: { NEXT_PUBLIC_BASE_PATH?: string } };

/** Next applies basePath to Link/router; browser APIs and public assets need it explicitly. */
export function appPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (!base || !path.startsWith("/") || path.startsWith("//") || path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`) || path.startsWith(`${base}#`)) return path;
  return base + path;
}
export function appRelativePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return base && (path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`)) ? path.slice(base.length) || "/" : path;
}
/** Keep the app prefix when constructing a cross-service destination. */
export function appUrl(base: string, path: string): URL {
  return new URL(path.replace(/^\/+/, ""), base.replace(/\/+$/, "") + "/");
}
/** A same-origin service is identified by its path as well as its hostname. */
export function pathInApp(url: URL, domain: string): string | null {
  let base: URL;
  try { base = new URL(domain); } catch { return null; }
  const prefix = base.pathname.replace(/\/$/, "");
  if (base.origin !== url.origin || (prefix && url.pathname !== prefix && !url.pathname.startsWith(prefix + "/"))) return null;
  return url.pathname.slice(prefix.length) || "/";
}
