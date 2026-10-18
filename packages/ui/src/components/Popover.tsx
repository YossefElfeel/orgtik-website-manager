"use client";
import type { ReactElement, ReactNode } from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "../lib/cn.js";
import { floatingPopup } from "../lib/overlay.js";

type Placement = { side?: "top" | "bottom" | "inline-start" | "inline-end"; align?: "start" | "center" | "end"; sideOffset?: number };

export const Popover = BasePopover.Root;
/** <PopoverTrigger render={<Button variant="secondary" />}>Filters</PopoverTrigger> */
export const PopoverTrigger = BasePopover.Trigger;
export const PopoverClose = BasePopover.Close;

export function PopoverContent({
  children,
  className,
  side = "bottom",
  align = "start",
  sideOffset = 8,
  title,
  description,
}: Placement & { children?: ReactNode; className?: string; title?: ReactNode; description?: ReactNode }) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50 outline-none">
        <BasePopover.Popup className={cn(floatingPopup, "flex max-w-[min(360px,calc(100vw-2rem))] flex-col gap-3 p-4", className)}>
          {title || description ? (
            <div className="flex flex-col gap-1">
              {title ? <BasePopover.Title className="text-title-sm text-fg">{title}</BasePopover.Title> : null}
              {description ? <BasePopover.Description className="text-body-sm text-fg-muted">{description}</BasePopover.Description> : null}
            </div>
          ) : null}
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

/** Put one near the app root so tooltips next to each other open without a second delay. */
export function TooltipProvider({ children, delay = 500 }: { children: ReactNode; delay?: number }) {
  return <BaseTooltip.Provider delay={delay}>{children}</BaseTooltip.Provider>;
}

/**
 * A short hint on hover and keyboard focus. It must never hold the only way to do something or
 * the only copy of information (no hover-only actions); an IconButton's label already gives it a
 * name, so this is extra.
 */
export function Tooltip({ content, children, side = "top", align = "center" }: Placement & { content: ReactNode; children: ReactElement }) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} align={align} sideOffset={6} className="z-50">
          <BaseTooltip.Popup
            className={cn(
              "max-w-64 rounded-field bg-chrome px-2.5 py-1.5 text-caption text-fg-on-chrome shadow-overlay",
              "origin-(--transform-origin) transition-[opacity,scale] duration-(--ot-duration-instant) ease-ot-out",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
