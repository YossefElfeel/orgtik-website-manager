import type { ReactNode } from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
export declare const Menu: <Payload>(props: BaseMenu.Root.Props<Payload>) => React.JSX.Element;
/** <MenuTrigger render={<IconButton label="More actions" icon={…} />} /> */
export declare const MenuTrigger: BaseMenu.Trigger;
export declare const MenuRadioGroup: import("react").NamedExoticComponent<Omit<import("@base-ui/react").ContextMenuRadioGroupProps, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export declare const MenuSub: typeof BaseMenu.SubmenuRoot;
type Placement = {
    side?: "top" | "bottom" | "inline-start" | "inline-end";
    align?: "start" | "center" | "end";
    sideOffset?: number;
};
export declare function MenuContent({ children, className, side, align, sideOffset }: Placement & {
    children: ReactNode;
    className?: string;
}): import("react").JSX.Element;
type ItemExtras = {
    /** An icon at the reading start. */
    icon?: ReactNode;
    /** A keyboard hint at the reading end, e.g. "⌘D". Display only. */
    shortcut?: string;
    /** danger for Delete and other destructive items. Put them last, after a separator. */
    tone?: "default" | "danger";
    className?: string;
};
export declare function MenuItem({ icon, shortcut, tone, className, children, ...props }: Omit<BaseMenu.Item.Props, "className"> & ItemExtras): import("react").JSX.Element;
/** A menu row that navigates. Renders a real link, so it opens in a new tab with a modifier key. */
export declare function MenuLinkItem({ icon, className, children, ...props }: Omit<BaseMenu.LinkItem.Props, "className"> & Omit<ItemExtras, "tone" | "shortcut">): import("react").JSX.Element;
export declare function MenuCheckboxItem({ className, children, ...props }: Omit<BaseMenu.CheckboxItem.Props, "className"> & {
    className?: string;
}): import("react").JSX.Element;
export declare function MenuRadioItem({ className, children, ...props }: Omit<BaseMenu.RadioItem.Props, "className"> & {
    className?: string;
}): import("react").JSX.Element;
export declare function MenuSubTrigger({ icon, className, children, ...props }: Omit<BaseMenu.SubmenuTrigger.Props, "className"> & Omit<ItemExtras, "tone" | "shortcut">): import("react").JSX.Element;
export declare function MenuSubContent({ children, className }: {
    children: ReactNode;
    className?: string;
}): import("react").JSX.Element;
export declare function MenuSeparator({ className }: {
    className?: string;
}): import("react").JSX.Element;
/** Related items under a heading. The heading is how screen readers name the group. */
export declare function MenuGroup({ label, children, className }: {
    label?: ReactNode;
    children: ReactNode;
    className?: string;
}): import("react").JSX.Element;
/** A group heading. Only valid inside MenuGroup or MenuRadioGroup; MenuGroup's `label` adds it for you. */
export declare function MenuLabel({ className, ...props }: Omit<BaseMenu.GroupLabel.Props, "className"> & {
    className?: string;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=Menu.d.ts.map