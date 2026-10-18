"use client";
import type { ReactNode } from "react";
import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import { Separator as BaseSeparator } from "@base-ui/react/separator";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";

// The panel grows and shrinks with Base UI's measured height; 1ms under reduced motion.
const panelMotion =
  "overflow-hidden transition-[height] duration-(--ot-duration-base) ease-ot-out data-[starting-style]:h-0 data-[ending-style]:h-0";

// Accordion ----------------------------------------------------------------------------------

export type AccordionItem = { value: string; title: ReactNode; content: ReactNode; disabled?: boolean };

/** Sections that open in place. `multiple` lets several stay open; FAQs and settings groups use it. */
export function Accordion({ items, multiple = false, defaultValue, className }: { items: AccordionItem[]; multiple?: boolean; defaultValue?: string[]; className?: string }) {
  return (
    <BaseAccordion.Root multiple={multiple} defaultValue={defaultValue} className={cn("flex flex-col divide-y divide-line rounded-card border border-line bg-raised", className)}>
      {items.map((item) => (
        <BaseAccordion.Item key={item.value} value={item.value} disabled={item.disabled}>
          <BaseAccordion.Header>
            <BaseAccordion.Trigger
              className={cn(
                "group flex w-full items-center justify-between gap-4 px-5 py-4 text-start font-body text-body font-semibold text-fg",
                "hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus data-[disabled]:opacity-50",
              )}
            >
              {item.title}
              <CaretDown aria-hidden="true" className="size-4 shrink-0 text-fg-muted transition-transform duration-(--ot-duration-base) group-data-[panel-open]:rotate-180" />
            </BaseAccordion.Trigger>
          </BaseAccordion.Header>
          <BaseAccordion.Panel className={cn(panelMotion, "h-(--accordion-panel-height)")}>
            <div className="px-5 pb-5 text-body text-fg-muted">{item.content}</div>
          </BaseAccordion.Panel>
        </BaseAccordion.Item>
      ))}
    </BaseAccordion.Root>
  );
}

// Collapsible --------------------------------------------------------------------------------

export const Collapsible = BaseCollapsible.Root;
/** <CollapsibleTrigger render={<Button variant="ghost" />}>Advanced</CollapsibleTrigger> */
export const CollapsibleTrigger = BaseCollapsible.Trigger;

export function CollapsiblePanel({ children, className }: { children: ReactNode; className?: string }) {
  return <BaseCollapsible.Panel className={cn(panelMotion, "h-(--collapsible-panel-height)", className)}>{children}</BaseCollapsible.Panel>;
}

// Separator and ScrollArea -------------------------------------------------------------------

export function Separator({ orientation = "horizontal", className }: { orientation?: "horizontal" | "vertical"; className?: string }) {
  return <BaseSeparator orientation={orientation} className={cn("shrink-0 bg-line", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)} />;
}

/**
 * A scrolling region with slim scrollbars that match the theme. The viewport is focusable, so
 * keyboard users can scroll it (axe: scrollable-region-focusable).
 */
export function ScrollArea({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const bar =
    "flex touch-none p-0.5 opacity-0 transition-opacity duration-(--ot-duration-fast) select-none data-[hovering]:opacity-100 data-[scrolling]:opacity-100";
  return (
    <BaseScrollArea.Root className={cn("relative overflow-hidden", className)}>
      <BaseScrollArea.Viewport tabIndex={0} aria-label={label} className="h-full w-full rounded-[inherit] outline-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
        {children}
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar orientation="vertical" className={cn(bar, "w-2.5")}>
        <BaseScrollArea.Thumb className="flex-1 rounded-pill bg-line-strong" />
      </BaseScrollArea.Scrollbar>
      <BaseScrollArea.Scrollbar orientation="horizontal" className={cn(bar, "h-2.5 flex-col")}>
        <BaseScrollArea.Thumb className="flex-1 rounded-pill bg-line-strong" />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  );
}
