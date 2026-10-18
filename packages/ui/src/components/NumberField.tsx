"use client";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import type { VariantProps } from "class-variance-authority";
import { Minus, Plus } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { controlFrame } from "../lib/control.js";
import { formatLocale } from "../locale.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";

export type NumberFieldProps = VariantProps<typeof controlFrame> & {
  value?: number | null;
  defaultValue?: number;
  onValueChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Show − and + buttons (default). Off for amounts where stepping makes no sense. */
  steppers?: boolean;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-label"?: string;
  className?: string;
  /** Intl options: the value is shown and parsed in the person's language and digits (D-016). */
  format?: Intl.NumberFormatOptions;
};

/**
 * A number, typed or stepped (arrow keys, − and +). It formats as the person's language writes
 * numbers, parses what they type back, and reads left to right inside RTL pages.
 */
export function NumberField({ steppers = true, size, className, format, "aria-label": ariaLabel, ...props }: NumberFieldProps) {
  const { locale, digits } = useOrgtik();
  const t = useStrings();
  const stepper = "grid h-full w-9 shrink-0 place-items-center text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-40";
  return (
    <BaseNumberField.Root locale={formatLocale(locale, digits)} format={format} {...props}>
      <BaseNumberField.Group dir="ltr" className={cn(controlFrame({ size }), "flex items-stretch overflow-hidden", className)}>
        {steppers ? (
          <BaseNumberField.Decrement aria-label={t("decrease")} className={cn(stepper, "border-e border-line")}>
            <Minus aria-hidden="true" className="size-3.5" />
          </BaseNumberField.Decrement>
        ) : null}
        <BaseNumberField.Input aria-label={ariaLabel} className="min-w-0 flex-1 bg-transparent px-3 text-start tabular-nums outline-none" />
        {steppers ? (
          <BaseNumberField.Increment aria-label={t("increase")} className={cn(stepper, "border-s border-line")}>
            <Plus aria-hidden="true" className="size-3.5" />
          </BaseNumberField.Increment>
        ) : null}
      </BaseNumberField.Group>
    </BaseNumberField.Root>
  );
}

export type MoneyFieldProps = Omit<NumberFieldProps, "format" | "step" | "steppers"> & {
  /** ISO 4217. The minor units follow it: CHF and SAR 2, KWD 3, JPY 0. */
  currency: string;
};

/** An amount of money in one currency, with the currency's own decimals. No steppers. */
export function MoneyField({ currency, ...props }: MoneyFieldProps) {
  const places = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return (
    <NumberField
      {...props}
      steppers={false}
      step={1 / 10 ** places}
      min={props.min ?? 0}
      format={{ style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: places, maximumFractionDigits: places }}
    />
  );
}

export type PercentFieldProps = Omit<NumberFieldProps, "format" | "min" | "max"> & { min?: number; max?: number; decimals?: number };

/** A percentage, in points (12 means 12%), 0–100 unless said otherwise. For discounts and rates. */
export function PercentField({ decimals = 0, min = 0, max = 100, step = 1, ...props }: PercentFieldProps) {
  return <NumberField {...props} min={min} max={max} step={step} format={{ style: "unit", unit: "percent", maximumFractionDigits: decimals }} />;
}
