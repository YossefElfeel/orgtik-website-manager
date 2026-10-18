"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { directionOf, formatLocale } from "../locale.js";
import { createTranslator } from "../i18n/strings.js";
const PlainLink = (props) => _jsx("a", { ...props });
const Context = createContext({ locale: "en", dir: "ltr", digits: "latn", t: createTranslator("en"), Link: PlainLink });
/**
 * Wrap each app once, inside <body>. It tells the library's components the language, the
 * reading direction (Base UI's keyboard handling follows it: spike base-ui-rtl) and the digits.
 * The app sets `lang` and `dir` on <html> itself, on the server (`directionOf`), so the first
 * paint is right. `strings` overrides any of the library's built-in words; `link` is the
 * component library links render as (next/link in Next apps).
 */
export function OrgtikProvider({ locale, digits = "latn", strings, link = PlainLink, children, }) {
    const dir = directionOf(locale);
    const value = useMemo(() => {
        const d = locale === "ar" ? digits : "latn";
        return { locale, dir, digits: d, t: createTranslator(locale, d, strings), Link: link };
    }, [locale, dir, digits, strings, link]);
    return (_jsx(Context.Provider, { value: value, children: _jsx(DirectionProvider, { direction: dir, children: children }) }));
}
export const useOrgtik = () => useContext(Context);
/** The library's translate function for the current language. */
export const useStrings = () => useContext(Context).t;
/** Formatting override for isolated presentation scenes, preserving the app's words and links. */
export function PresentationFormatting({ digits, timeZone, children }) {
    const outer = useContext(Context);
    const value = useMemo(() => ({ ...outer, digits: outer.locale === "ar" ? digits : "latn", presentationTimeZone: timeZone }), [outer, digits, timeZone]);
    return _jsx(Context.Provider, { value: value, children: children });
}
/** Number, money, percent and date formatting in the current language and digits. */
export function useFormatter() {
    const { locale, digits, presentationTimeZone } = useOrgtik();
    return useMemo(() => {
        const tag = formatLocale(locale, digits);
        return {
            number: (n, options) => new Intl.NumberFormat(tag, options).format(n),
            money: (amount, currency) => new Intl.NumberFormat(tag, { style: "currency", currency }).format(amount),
            percent: (ratio, maximumFractionDigits = 0) => new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits }).format(ratio),
            date: (d, options = { dateStyle: "medium" }) => new Intl.DateTimeFormat(tag, { ...options, timeZone: options.timeZone ?? presentationTimeZone }).format(new Date(d)),
            /** File sizes with the language's own unit words ("438 kB", "438 كيلوبايت"), so bidi can't reorder them. */
            bytes: (n) => {
                const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"];
                let i = 0;
                let v = n;
                while (v >= 1024 && i < units.length - 1) {
                    v /= 1024;
                    i++;
                }
                return new Intl.NumberFormat(tag, { style: "unit", unit: units[i], unitDisplay: "short", maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 }).format(v);
            },
        };
    }, [locale, digits, presentationTimeZone]);
}
//# sourceMappingURL=OrgtikProvider.js.map