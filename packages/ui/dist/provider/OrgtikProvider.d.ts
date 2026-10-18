import { type AnchorHTMLAttributes, type ComponentType, type ReactNode } from "react";
import { type Digits, type Locale } from "../locale.js";
import { type Strings, type Translate } from "../i18n/strings.js";
/** The element library links render as. Next apps pass next/link, so navigation stays client-side. */
export type LinkComponent = ComponentType<Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
}>;
type OrgtikContext = {
    locale: Locale;
    dir: "ltr" | "rtl";
    digits: Digits;
    t: Translate;
    Link: LinkComponent;
    presentationTimeZone?: string;
};
/**
 * Wrap each app once, inside <body>. It tells the library's components the language, the
 * reading direction (Base UI's keyboard handling follows it: spike base-ui-rtl) and the digits.
 * The app sets `lang` and `dir` on <html> itself, on the server (`directionOf`), so the first
 * paint is right. `strings` overrides any of the library's built-in words; `link` is the
 * component library links render as (next/link in Next apps).
 */
export declare function OrgtikProvider({ locale, digits, strings, link, children, }: {
    locale: Locale;
    digits?: Digits;
    strings?: Partial<Strings>;
    link?: LinkComponent;
    children: ReactNode;
}): import("react").JSX.Element;
export declare const useOrgtik: () => OrgtikContext;
/** The library's translate function for the current language. */
export declare const useStrings: () => Translate;
/** Formatting override for isolated presentation scenes, preserving the app's words and links. */
export declare function PresentationFormatting({ digits, timeZone, children }: {
    digits: Digits;
    timeZone: string;
    children: ReactNode;
}): import("react").JSX.Element;
/** Number, money, percent and date formatting in the current language and digits. */
export declare function useFormatter(): {
    number: (n: number, options?: Intl.NumberFormatOptions) => string;
    money: (amount: number, currency: string) => string;
    percent: (ratio: number, maximumFractionDigits?: number) => string;
    date: (d: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    /** File sizes with the language's own unit words ("438 kB", "438 كيلوبايت"), so bidi can't reorder them. */
    bytes: (n: number) => string;
};
export {};
//# sourceMappingURL=OrgtikProvider.d.ts.map