export type Locale = "en" | "ar" | "de" | "fr" | "it";
/** D-016: a per-person setting for Arabic; every other language uses Latin digits. */
export type Digits = "latn" | "arab";
export declare const LOCALES: readonly Locale[];
export declare const directionOf: (locale: Locale) => "ltr" | "rtl";
/** The Intl locale tag for formatting, with the person's digits (D-016). */
export declare function formatLocale(locale: Locale, digits?: Digits): string;
//# sourceMappingURL=locale.d.ts.map