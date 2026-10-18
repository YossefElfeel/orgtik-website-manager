export type Theme = "light" | "dark";
/** The cookie every OrgTik app reads, so a person's theme follows them across the suite. */
export declare const THEME_COOKIE = "ot-theme";
/** D-023: the dashboards open in the light theme. */
export declare const DEFAULT_THEME: Theme;
/**
 * Sets `data-theme` on <html> before the first paint, from the person's cookie, so a dark-theme
 * user never sees a flash of light. Render it in <head>. (A server can also read the cookie and
 * set `data-theme` itself; the script makes static and cached pages right too.)
 */
export declare function ThemeScript({ nonce }: {
    nonce?: string;
}): import("react").JSX.Element;
/** The theme a cookie value names ("dark" or "light"); the default for anything else. */
export declare function themeFrom(cookieValue?: string | null): Theme;
/**
 * The attributes for <html>, from the THEME_COOKIE value the server read. Set them as well as
 * rendering ThemeScript: Next renders a 404 or an error inside its own shell and then replaces
 * <html> on the client, which drops what the script set, so a dark-theme reader got a light 404.
 *
 *   <html lang={locale} dir={dir} {...themeAttributes((await cookies()).get(THEME_COOKIE)?.value)}>
 */
export declare function themeAttributes(cookieValue?: string | null): {
    "data-theme": Theme;
    style: {
        colorScheme: Theme;
    };
};
//# sourceMappingURL=theme-script.d.ts.map