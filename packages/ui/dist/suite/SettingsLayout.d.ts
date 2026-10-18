import type { ReactNode } from "react";
export type SettingsSection = {
    id: string;
    label: string;
    href: string;
    icon?: ReactNode;
};
export declare function SettingsLayout({ title, description, sections, active, actions, children }: {
    title: string;
    description?: string;
    sections: SettingsSection[];
    active: string;
    actions?: ReactNode;
    children: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=SettingsLayout.d.ts.map