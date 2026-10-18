// Plain helpers, safe to call from server code (a Next layout sets `lang` and `dir` on <html>).
export type Locale = "en" | "ar" | "de" | "fr" | "it";
/** D-016: a per-person setting for Arabic; every other language uses Latin digits. */
export type Digits = "latn" | "arab";

export const LOCALES: readonly Locale[] = ["en", "ar", "de", "fr", "it"];

export const directionOf = (locale: Locale): "ltr" | "rtl" => (locale === "ar" ? "rtl" : "ltr");

/** The Intl locale tag for formatting, with the person's digits (D-016). */
export function formatLocale(locale: Locale, digits: Digits = "latn"): string {
  if (locale === "ar") return `ar-u-nu-${digits}`;
  return { en: "en-GB", de: "de-CH", fr: "fr-CH", it: "it-CH" }[locale];
}
