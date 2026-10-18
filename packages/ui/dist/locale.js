export const LOCALES = ["en", "ar", "de", "fr", "it"];
export const directionOf = (locale) => (locale === "ar" ? "rtl" : "ltr");
/** The Intl locale tag for formatting, with the person's digits (D-016). */
export function formatLocale(locale, digits = "latn") {
    if (locale === "ar")
        return `ar-u-nu-${digits}`;
    return { en: "en-GB", de: "de-CH", fr: "fr-CH", it: "it-CH" }[locale];
}
//# sourceMappingURL=locale.js.map