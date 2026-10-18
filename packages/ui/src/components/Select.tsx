"use client";
import type { ReactNode } from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import type { VariantProps } from "class-variance-authority";
import { CaretDown, Check } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { controlFrame } from "../lib/control.js";
import { useStrings } from "../provider/OrgtikProvider.js";

export type SelectOption<V extends string = string> = { value: V; label: ReactNode; disabled?: boolean };
export type SelectGroup<V extends string = string> = { label: ReactNode; options: SelectOption<V>[] };

export type SelectProps<V extends string = string> = VariantProps<typeof controlFrame> & {
  /** The choices, flat or in labelled groups. */
  options: Array<SelectOption<V> | SelectGroup<V>>;
  value?: V | null;
  defaultValue?: V | null;
  onValueChange?: (value: V | null) => void;
  placeholder?: ReactNode;
  /** Visible context for standalone filters, e.g. Status: All. */
  label?: ReactNode;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  "aria-label"?: string;
};

const isGroup = <V extends string>(o: SelectOption<V> | SelectGroup<V>): o is SelectGroup<V> => "options" in o;

/** Picks one value from a short list. Past about 12 options, or for search, use a Combobox. */
export function Select<V extends string = string>({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  label,
  size,
  className,
  "aria-label": ariaLabel,
  ...props
}: SelectProps<V>) {
  const t = useStrings();
  const visibleLabel = label ?? (value === "all" ? ariaLabel : undefined);
  const flat = options.flatMap((o) => (isGroup(o) ? o.options : [o]));
  const item = (o: SelectOption<V>) => (
    <BaseSelect.Item
      key={o.value}
      value={o.value}
      disabled={o.disabled}
      className="flex h-control-sm cursor-default items-center gap-2 rounded-field ps-2 pe-3 text-body text-fg outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover"
    >
      <span className="grid size-4 shrink-0 place-items-center text-fg-brand">
        <BaseSelect.ItemIndicator>
          <Check weight="bold" className="size-3.5" />
        </BaseSelect.ItemIndicator>
      </span>
      <BaseSelect.ItemText className="truncate">{o.label}</BaseSelect.ItemText>
    </BaseSelect.Item>
  );
  return (
    <BaseSelect.Root<V>
      items={flat.map((o) => ({ value: o.value, label: o.label }))}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(v as V | null)}
      {...props}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        className={cn(
          controlFrame({ size }),
          "flex cursor-default items-center justify-between gap-2 ps-3 pe-2 text-start outline-none select-none data-[popup-open]:border-focus",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {visibleLabel ? <span className="shrink-0 text-fg-muted">{visibleLabel}:</span> : null}
          <BaseSelect.Value placeholder={placeholder ?? t("selectPlaceholder")} className="truncate data-[placeholder]:text-fg-subtle" />
        </span>
        <BaseSelect.Icon className="grid shrink-0 place-items-center text-fg-muted">
          <CaretDown aria-hidden="true" className="size-4" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50 outline-none">
          <BaseSelect.Popup
            className={cn(
              "max-h-[min(var(--available-height),22rem)] min-w-(--anchor-width) overflow-y-auto rounded-overlay border border-line bg-overlay p-1 shadow-overlay outline-none",
              "origin-(--transform-origin) transition-[opacity,scale] duration-(--ot-duration-fast) ease-ot-out",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            )}
          >
            <BaseSelect.List>
              {flat.length === 0 ? <div className="px-3 py-2 text-body-sm text-fg-subtle">{t("noOptions")}</div> : null}
              {options.map((o, i) =>
                isGroup(o) ? (
                  <BaseSelect.Group key={i} className="py-1 first:pt-0">
                    <BaseSelect.GroupLabel className="px-2 pt-1 pb-1 text-caption font-semibold text-fg-subtle">{o.label}</BaseSelect.GroupLabel>
                    {o.options.map(item)}
                  </BaseSelect.Group>
                ) : (
                  item(o)
                ),
              )}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
