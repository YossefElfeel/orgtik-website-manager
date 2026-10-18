// Per-language addresses (S5, D-036, D-037): /ar/…, /de/…, /fr/…, /it/…; English has no prefix.
// The pages keep routing by their English addresses: the prefix is read here, taken off before the
// routes are matched and put back on every address the site writes. Words come from the language's
// published copy when there is one, else from English; a language only reaches visitors once the
// Website Manager makes it public (publicLocales), so until then it shows in development and in
// a preview only.
import { siteSettings } from "./heads.js";
import { isPreview } from "./preview.js";

export const LOCALES = ["en", "ar", "de", "fr", "it"];
const PREFIX = /^\/(ar|de|fr|it)(?=\/|$)/;

/** "/ar/services/design" → { locale: "ar", path: "/services/design" }. */
export function splitLocale(pathname) {
  const m = String(pathname || "/").match(PREFIX);
  return m
    ? { locale: m[1], path: pathname.slice(m[0].length) || "/" }
    : { locale: "en", path: pathname || "/" };
}

export const bare = (pathname) => splitLocale(pathname).path;
export const currentLocale = () =>
  typeof window === "undefined"
    ? "en"
    : splitLocale(window.location?.pathname).locale;
export const dirOf = (locale) => (locale === "ar" ? "rtl" : "ltr");

/** An address of this site in the current language ("/services" on an Arabic page → "/ar/services"). */
export function withLocale(path, locale = currentLocale()) {
  if (
    locale === "en" ||
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    PREFIX.test(path)
  )
    return path;
  return `/${locale}${path === "/" ? "" : path}`;
}

/** Whether this language may be shown here: public, or in development or a Website Manager preview. */
export function shown(locale) {
  if (locale === "en") return true;
  if ((siteSettings()?.publicLocales ?? ["en"]).includes(locale)) return true;
  return Boolean(import.meta.env?.DEV) || isPreview();
}

/** A record's words in the current language, else English (only reachable where `shown`). */
export const wordsOf = (locales) => locales?.[currentLocale()] ?? locales?.en;

/** A small horizontal move ("8px") in the reading direction: mirrored on right-to-left pages. */
export const nudge = (px) =>
  typeof document !== "undefined" &&
  document.documentElement.dir === "rtl" &&
  px !== "0px"
    ? `-${px}`
    : px;
