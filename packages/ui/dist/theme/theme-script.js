import { jsx as _jsx } from "react/jsx-runtime";
/** The cookie every OrgTik app reads, so a person's theme follows them across the suite. */
export const THEME_COOKIE = "ot-theme";
/** D-023: the dashboards open in the light theme. */
export const DEFAULT_THEME = "light";
const script = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);document.documentElement.setAttribute("data-theme",m?m[1]:"${DEFAULT_THEME}");}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}");}})();`;
/**
 * Sets `data-theme` on <html> before the first paint, from the person's cookie, so a dark-theme
 * user never sees a flash of light. Render it in <head>. (A server can also read the cookie and
 * set `data-theme` itself; the script makes static and cached pages right too.)
 */
export function ThemeScript({ nonce }) {
    return _jsx("script", { nonce: nonce, dangerouslySetInnerHTML: { __html: script } });
}
/** The theme a cookie value names ("dark" or "light"); the default for anything else. */
export function themeFrom(cookieValue) {
    return cookieValue === "dark" || cookieValue === "light" ? cookieValue : DEFAULT_THEME;
}
/**
 * The attributes for <html>, from the THEME_COOKIE value the server read. Set them as well as
 * rendering ThemeScript: Next renders a 404 or an error inside its own shell and then replaces
 * <html> on the client, which drops what the script set, so a dark-theme reader got a light 404.
 *
 *   <html lang={locale} dir={dir} {...themeAttributes((await cookies()).get(THEME_COOKIE)?.value)}>
 */
export function themeAttributes(cookieValue) {
    const theme = themeFrom(cookieValue);
    return { "data-theme": theme, style: { colorScheme: theme } };
}
//# sourceMappingURL=theme-script.js.map