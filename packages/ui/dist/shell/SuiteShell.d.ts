import { type ReactNode } from "react";
import { type Locale } from "../locale.js";
import { type DemoOptions } from "../demo/DemoPanel.js";
export type RailApp = {
    id: string;
    label: string;
    href: string;
    icon: ReactNode;
    badge?: ReactNode;
    onNavigate?: () => void;
};
export declare function AppRail({ apps, current, homeHref }: {
    apps: RailApp[];
    current?: string;
    homeHref?: string;
}): import("react").JSX.Element;
export type SidebarItem = {
    label: string;
    href: string;
    icon?: ReactNode;
    active?: boolean;
    count?: number;
};
export type SidebarSection = {
    label?: string;
    items: SidebarItem[];
};
export declare function Sidebar({ title, sections, footer }: {
    title: ReactNode;
    sections: SidebarSection[];
    footer?: ReactNode;
}): import("react").JSX.Element;
/** The person's menu: who they are, theme, language, sign out. */
export declare function UserMenu({ name, email, avatarSrc, locales, onLocaleChange, onSignOut, children, }: {
    name: string;
    email?: string;
    avatarSrc?: string;
    locales?: readonly Locale[];
    onLocaleChange?: (locale: Locale) => void;
    onSignOut: () => void;
    /** Extra items, e.g. "Profile" and "Workspace settings". */
    children?: ReactNode;
}): import("react").JSX.Element;
export declare function TopBar({ start, end, onOpenNavigation }: {
    start?: ReactNode;
    end?: ReactNode;
    onOpenNavigation?: () => void;
}): import("react").JSX.Element;
export type SuiteShellProps = {
    sidebarCollapsed?: boolean;
    demo?: DemoOptions;
    rail: ReactNode;
    sidebar: ReactNode;
    /** TopBar's contents: `start` (search, workspace switcher) and `end` (help, notifications, UserMenu). */
    topBar?: {
        start?: ReactNode;
        end?: ReactNode;
    };
    /** <BannerRegion banners={…} />: sits above the page, below the top bar. */
    banner?: ReactNode;
    children: ReactNode;
};
/**
 * The suite's frame: rail + sidebar + top bar + banner slot + content. Under 1024px the rail
 * and sidebar move into a sheet opened from the top bar.
 */
export declare function SuiteShell(props: SuiteShellProps): import("react").JSX.Element;
//# sourceMappingURL=SuiteShell.d.ts.map