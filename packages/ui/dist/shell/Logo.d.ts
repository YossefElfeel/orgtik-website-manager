export type LogoProps = {
    /** mark: the symbol alone (rails, favicons); wordmark: the name. */
    variant?: "mark" | "wordmark";
    /** current draws in the text colour; brand gives the mark the colour lockup's gradient. */
    tone?: "current" | "brand";
    /** The accessible name. Pass "" when a visible "OrgTik" label sits next to it. */
    label?: string;
    className?: string;
};
/** The OrgTik logo, from the website's files. It never mirrors in RTL. Server-safe. */
export declare function Logo({ variant, tone, label, className }: LogoProps): import("react").JSX.Element;
//# sourceMappingURL=Logo.d.ts.map