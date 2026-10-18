import type { RailApp } from "../shell/SuiteShell.js";
export declare const SUITE_ICONS: {
    tasks: import("react").JSX.Element;
    files: import("react").JSX.Element;
    hr: import("react").JSX.Element;
    crm: import("react").JSX.Element;
    marketing: import("react").JSX.Element;
    chat: import("react").JSX.Element;
};
export declare function useSuiteApps({ currentScope, currentHref, sosUrl, onNavigate }: {
    currentScope: string;
    currentHref: string;
    sosUrl: string;
    onNavigate?: (href: string) => void;
}): RailApp[];
//# sourceMappingURL=useSuiteApps.d.ts.map