"use client";
import type { ReactNode } from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { CaretRight, Check } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { floatingPopup, listItem } from "../lib/overlay.js";

// Replaces the apps' dropdown-menu. Submenus open toward the reading end (spike base-ui-rtl).
export const Menu = BaseMenu.Root;
/** <MenuTrigger render={<IconButton label="More actions" icon={…} />} /> */
export const MenuTrigger = BaseMenu.Trigger;
export const MenuRadioGroup = BaseMenu.RadioGroup;
export const MenuSub = BaseMenu.SubmenuRoot;

type Placement = { side?: "top" | "bottom" | "inline-start" | "inline-end"; align?: "start" | "center" | "end"; sideOffset?: number };

export function MenuContent({ children, className, side = "bottom", align = "start", sideOffset = 6 }: Placement & { children: ReactNode; className?: string }) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50 outline-none">
        <BaseMenu.Popup className={cn(floatingPopup, "min-w-48 p-1", className)}>{children}</BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

type ItemExtras = {
  /** An icon at the reading start. */
  icon?: ReactNode;
  /** A keyboard hint at the reading end, e.g. "⌘D". Display only. */
  shortcut?: string;
  /** danger for Delete and other destructive items. Put them last, after a separator. */
  tone?: "default" | "danger";
  className?: string;
};

const Icon = ({ children }: { children?: ReactNode }) => (
  <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center text-fg-muted group-data-[tone=danger]:text-danger">
    {children}
  </span>
);

export function MenuItem({ icon, shortcut, tone = "default", className, children, ...props }: Omit<BaseMenu.Item.Props, "className"> & ItemExtras) {
  return (
    <BaseMenu.Item data-tone={tone} className={cn(listItem, "group", tone === "danger" && "text-danger", className)} {...props}>
      {icon ? <Icon>{icon}</Icon> : null}
      <span className="flex-1 truncate">{children}</span>
      {shortcut ? <kbd dir="ltr" className="ms-6 font-body text-caption text-fg-subtle">{shortcut}</kbd> : null}
    </BaseMenu.Item>
  );
}

/** A menu row that navigates. Renders a real link, so it opens in a new tab with a modifier key. */
export function MenuLinkItem({ icon, className, children, ...props }: Omit<BaseMenu.LinkItem.Props, "className"> & Omit<ItemExtras, "tone" | "shortcut">) {
  return (
    <BaseMenu.LinkItem className={cn(listItem, className)} {...props}>
      {icon ? <Icon>{icon}</Icon> : null}
      <span className="flex-1 truncate">{children}</span>
    </BaseMenu.LinkItem>
  );
}

export function MenuCheckboxItem({ className, children, ...props }: Omit<BaseMenu.CheckboxItem.Props, "className"> & { className?: string }) {
  return (
    <BaseMenu.CheckboxItem className={cn(listItem, className)} {...props}>
      <span className="grid size-4 shrink-0 place-items-center text-fg-brand">
        <BaseMenu.CheckboxItemIndicator>
          <Check weight="bold" className="size-3.5" />
        </BaseMenu.CheckboxItemIndicator>
      </span>
      <span className="flex-1 truncate">{children}</span>
    </BaseMenu.CheckboxItem>
  );
}

export function MenuRadioItem({ className, children, ...props }: Omit<BaseMenu.RadioItem.Props, "className"> & { className?: string }) {
  return (
    <BaseMenu.RadioItem className={cn(listItem, className)} {...props}>
      <span className="grid size-4 shrink-0 place-items-center text-fg-brand">
        <BaseMenu.RadioItemIndicator>
          <span className="block size-2 rounded-pill bg-current" />
        </BaseMenu.RadioItemIndicator>
      </span>
      <span className="flex-1 truncate">{children}</span>
    </BaseMenu.RadioItem>
  );
}

export function MenuSubTrigger({ icon, className, children, ...props }: Omit<BaseMenu.SubmenuTrigger.Props, "className"> & Omit<ItemExtras, "tone" | "shortcut">) {
  return (
    <BaseMenu.SubmenuTrigger className={cn(listItem, "data-[popup-open]:bg-hover", className)} {...props}>
      {icon ? <Icon>{icon}</Icon> : null}
      <span className="flex-1 truncate">{children}</span>
      <CaretRight aria-hidden="true" className="size-3.5 text-fg-subtle rtl:-scale-x-100" />
    </BaseMenu.SubmenuTrigger>
  );
}

export function MenuSubContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner side="inline-end" align="start" sideOffset={4} alignOffset={-4} className="z-50 outline-none">
        <BaseMenu.Popup className={cn(floatingPopup, "min-w-44 p-1", className)}>{children}</BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return <BaseMenu.Separator className={cn("mx-2 my-1 h-px bg-line", className)} />;
}

/** Related items under a heading. The heading is how screen readers name the group. */
export function MenuGroup({ label, children, className }: { label?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <BaseMenu.Group className={className}>
      {label ? <MenuLabel>{label}</MenuLabel> : null}
      {children}
    </BaseMenu.Group>
  );
}

/** A group heading. Only valid inside MenuGroup or MenuRadioGroup; MenuGroup's `label` adds it for you. */
export function MenuLabel({ className, ...props }: Omit<BaseMenu.GroupLabel.Props, "className"> & { className?: string }) {
  return <BaseMenu.GroupLabel className={cn("px-2 pt-1.5 pb-1 text-caption font-semibold text-fg-subtle", className)} {...props} />;
}
