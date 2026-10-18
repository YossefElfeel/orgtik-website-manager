import { type Locale } from "../locale.js";
export type LocalizedValue = Partial<Record<Locale, string>>;
export type LocalizedFieldProps = {
    label: string;
    value: LocalizedValue;
    onChange: (value: LocalizedValue) => void;
    /** The languages to edit, in tab order. */
    locales?: readonly Locale[];
    /** D-014 (proposed): English and Arabic must be filled; the others fall back until translated. */
    required?: readonly Locale[];
    /** The language the others fall back to. */
    fallback?: Locale;
    /** Errors per language, e.g. from the server. The field opens the first one that has an error. */
    errors?: LocalizedValue;
    multiline?: boolean;
    description?: string;
    className?: string;
};
/**
 * One piece of text in several languages. Each language is a tab with its own state, so the
 * form shows at a glance what's done, what's required and missing, and what falls back. The
 * input takes that language's lang and direction.
 *
 * The pattern is D-014's proposal, which replaces the spec's side-by-side AR/EN inputs. It
 * waits for the PM's confirmation.
 */
export declare function LocalizedField({ label, value, onChange, locales, required, fallback, errors, multiline, description, className, }: LocalizedFieldProps): import("react").JSX.Element;
//# sourceMappingURL=LocalizedField.d.ts.map