"use client";
import { useMemo, type ReactNode } from "react";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import type { VariantProps } from "class-variance-authority";
import { CaretDown, Check, MagnifyingGlass, X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { controlFrame } from "../lib/control.js";
import { floatingPopup, listItem } from "../lib/overlay.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";

export type ComboOption<V extends string = string> = {
  value: V;
  /** Text to match and show. Keep it plain text: typing filters on it. */
  label: string;
  /** A second line, e.g. an email next to a name. */
  hint?: string;
  disabled?: boolean;
};

type Common<V extends string> = VariantProps<typeof controlFrame> & {
  options: ComboOption<V>[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  "aria-label"?: string;
  /** Shown when nothing matches the typed text. */
  emptyText?: ReactNode;
  className?: string;
};

function Popup<V extends string>({ emptyText }: { emptyText?: ReactNode }) {
  const t = useStrings();
  return (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner sideOffset={6} className="z-50 outline-none">
        <BaseCombobox.Popup className={cn(floatingPopup, "max-h-[min(var(--available-height),22rem)] w-(--anchor-width) overflow-y-auto p-1")}>
          <BaseCombobox.Empty className="px-3 py-2 text-body-sm text-fg-subtle empty:hidden">{emptyText ?? t("noResults")}</BaseCombobox.Empty>
          <BaseCombobox.List>
            {(o: ComboOption<V>) => (
              <BaseCombobox.Item key={o.value} value={o} disabled={o.disabled} className={cn(listItem, "py-1.5")}>
                <span className="grid size-4 shrink-0 place-items-center text-fg-brand">
                  <BaseCombobox.ItemIndicator>
                    <Check weight="bold" className="size-3.5" />
                  </BaseCombobox.ItemIndicator>
                </span>
                <span className="flex min-w-0 flex-col">
                  <span dir="auto" className="truncate">{o.label}</span>
                  {o.hint ? <span dir="auto" className="truncate text-caption text-fg-subtle">{o.hint}</span> : null}
                </span>
              </BaseCombobox.Item>
            )}
          </BaseCombobox.List>
        </BaseCombobox.Popup>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  );
}

export type ComboboxProps<V extends string = string> = Common<V> & {
  value?: V | null;
  defaultValue?: V | null;
  onValueChange?: (value: V | null) => void;
};

/** Pick one from many by typing (people, folders, countries). For a short fixed list use Select. */
export function Combobox<V extends string = string>({ options, value, defaultValue, onValueChange, placeholder, size, emptyText, className, "aria-label": ariaLabel, ...props }: ComboboxProps<V>) {
  const { locale } = useOrgtik();
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const t = useStrings();
  return (
    <BaseCombobox.Root<ComboOption<V>>
      items={options}
      locale={locale}
      itemToStringLabel={(o) => o.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      value={value === undefined ? undefined : value === null ? null : byValue.get(value) ?? null}
      defaultValue={defaultValue ? byValue.get(defaultValue) ?? null : undefined}
      onValueChange={(o) => onValueChange?.(((o as ComboOption<V> | null)?.value ?? null) as V | null)}
      {...props}
    >
      <div className={cn(controlFrame({ size }), "flex items-center gap-2 ps-3 pe-1", className)}>
        <MagnifyingGlass aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
        <BaseCombobox.Input aria-label={ariaLabel} placeholder={placeholder} className="h-full min-w-0 flex-1 bg-transparent text-start outline-none placeholder:text-fg-subtle" />
        <BaseCombobox.Clear aria-label={t("clear")} className="grid size-7 place-items-center rounded-pill text-fg-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus">
          <X aria-hidden="true" className="size-3.5" />
        </BaseCombobox.Clear>
        <BaseCombobox.Trigger aria-label={ariaLabel} className="grid size-7 place-items-center rounded-pill text-fg-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus">
          <CaretDown aria-hidden="true" className="size-4" />
        </BaseCombobox.Trigger>
      </div>
      <Popup<V> emptyText={emptyText} />
    </BaseCombobox.Root>
  );
}

export type MultiSelectProps<V extends string = string> = Common<V> & {
  value?: V[];
  defaultValue?: V[];
  onValueChange?: (value: V[]) => void;
};

/** Pick several (people to share with, tags). Chosen items show as removable chips. */
export function MultiSelect<V extends string = string>({ options, value, defaultValue, onValueChange, placeholder, size, emptyText, className, "aria-label": ariaLabel, ...props }: MultiSelectProps<V>) {
  const t = useStrings();
  const { locale } = useOrgtik();
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const pick = (vs?: V[]) => (vs ? vs.map((v) => byValue.get(v)).filter((o): o is ComboOption<V> => Boolean(o)) : undefined);
  return (
    <BaseCombobox.Root<ComboOption<V>, true>
      multiple
      items={options}
      locale={locale}
      itemToStringLabel={(o) => o.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      value={pick(value)}
      defaultValue={pick(defaultValue)}
      onValueChange={(os) => onValueChange?.((os as ComboOption<V>[]).map((o) => o.value))}
      {...props}
    >
      <BaseCombobox.Chips className={cn(controlFrame({ size }), "flex h-auto min-h-control-md flex-wrap items-center gap-1.5 px-2 py-1.5", className)}>
        <BaseCombobox.Value>
          {(chosen: ComboOption<V>[]) => (
            <>
              {chosen.map((o) => (
                <BaseCombobox.Chip key={o.value} className="inline-flex h-7 items-center gap-1 rounded-pill bg-brand-subtle ps-2.5 pe-1 text-body-sm text-fg-brand outline-hidden focus-visible:outline-2 focus-visible:outline-focus">
                  <span dir="auto">{o.label}</span>
                  <BaseCombobox.ChipRemove aria-label={t("removeItem", { label: o.label })} className="grid size-5 place-items-center rounded-pill hover:bg-hover">
                    <X aria-hidden="true" className="size-3" />
                  </BaseCombobox.ChipRemove>
                </BaseCombobox.Chip>
              ))}
              <BaseCombobox.Input aria-label={ariaLabel} placeholder={chosen.length ? "" : placeholder} className="h-7 min-w-24 flex-1 bg-transparent px-1 text-start outline-none placeholder:text-fg-subtle" />
            </>
          )}
        </BaseCombobox.Value>
      </BaseCombobox.Chips>
      <Popup<V> emptyText={emptyText} />
    </BaseCombobox.Root>
  );
}
