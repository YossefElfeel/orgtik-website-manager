"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { CheckCircle, Circle, WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { LOCALES, directionOf, type Locale } from "../locale.js";
import { useStrings } from "../provider/OrgtikProvider.js";

const NATIVE: Record<Locale, string> = { en: "English", ar: "العربية", de: "Deutsch", fr: "Français", it: "Italiano" };

export type LocalizedValue = Partial<Record<Locale, string>>;

export type LocalizedFieldProps = {
  label: string;
  value: LocalizedValue;
  onChange: (value: LocalizedValue) => void;
  /** The languages to edit, in tab order. */
  locales?: readonly Locale[];
  /** D-014 (proposed): English and Arabic must be filled; the others fall back until translated. */
  required?: readonly Locale[];
  /** The language the others fall back to. */
  fallback?: Locale;
  /** Errors per language, e.g. from the server. The field opens the first one that has an error. */
  errors?: LocalizedValue;
  multiline?: boolean;
  description?: string;
  className?: string;
};

/**
 * One piece of text in several languages. Each language is a tab with its own state, so the
 * form shows at a glance what's done, what's required and missing, and what falls back. The
 * input takes that language's lang and direction.
 *
 * The pattern is D-014's proposal, which replaces the spec's side-by-side AR/EN inputs. It
 * waits for the PM's confirmation.
 */
export function LocalizedField({
  label,
  value,
  onChange,
  locales = LOCALES,
  required = ["en", "ar"],
  fallback = "en",
  errors,
  multiline = false,
  description,
  className,
}: LocalizedFieldProps) {
  const t = useStrings();
  const id = useId();
  const [active, setActive] = useState<Locale>(locales[0]!);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const firstError = locales.find((l) => errors?.[l]);

  // When errors arrive, open the first language that has one and put the cursor there.
  useEffect(() => {
    if (firstError) {
      setActive(firstError);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [firstError]);

  const state = (l: Locale) => (errors?.[l] ? "error" : value[l]?.trim() ? "done" : required.includes(l) ? "missing" : "fallback");
  const done = locales.filter((l) => state(l) === "done").length;
  const Control = multiline ? "textarea" : "input";

  return (
    <div role="group" aria-labelledby={`${id}-label`} className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="text-label text-fg">
          {label}
        </span>
        <span className="text-caption text-fg-muted tabular-nums">{t("translatedCount", { done, total: locales.length })}</span>
      </div>
      {/* Base UI Tabs: arrow keys move between languages, in the reading direction. */}
      <BaseTabs.Root value={active} onValueChange={(v) => setActive(v as Locale)}>
        <BaseTabs.List aria-label={t("language")} className="flex flex-wrap gap-1">
          {locales.map((l) => {
            const s = state(l);
            return (
              <BaseTabs.Tab
                key={l}
                value={l}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-pill bg-sunken px-3 text-body-sm font-semibold text-fg-muted transition-colors hover:text-fg",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  "data-[active]:bg-action-primary data-[active]:text-on-action-primary",
                )}
              >
                <span lang={l} dir={l === "ar" ? "rtl" : "ltr"}>{NATIVE[l]}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "[&_svg]:size-3.5",
                    // On the active (filled) tab the icon takes the tab's own colour.
                    active !== l && (s === "done" ? "text-success" : s === "error" || s === "missing" ? "text-danger" : "text-fg-subtle"),
                  )}
                >
                  {s === "done" ? <CheckCircle weight="fill" /> : s === "error" || s === "missing" ? <WarningCircle weight="fill" /> : <Circle />}
                </span>
                <span className="sr-only">
                  {s === "done" ? t("localeDone") : s === "error" ? errors?.[l] : s === "missing" ? t("localeMissing") : t("localeFallback", { language: NATIVE[fallback] })}
                </span>
              </BaseTabs.Tab>
            );
          })}
        </BaseTabs.List>
        <BaseTabs.Panel value={active} className="mt-2 flex flex-col gap-1.5">
        <Control
          ref={inputRef}
          key={active}
          lang={active}
          dir={directionOf(active)}
          aria-label={`${label} (${NATIVE[active]})`}
          aria-invalid={errors?.[active] ? true : undefined}
          aria-required={required.includes(active) || undefined}
          value={value[active] ?? ""}
          placeholder={state(active) === "fallback" && value[fallback] ? value[fallback] : undefined}
          onChange={(e) => onChange({ ...value, [active]: e.target.value })}
          rows={multiline ? 3 : undefined}
          className={cn(
            "w-full rounded-field border border-line-control bg-raised px-3 text-body text-fg outline-hidden placeholder:text-fg-subtle hover:border-fg-subtle",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus aria-invalid:border-danger",
            multiline ? "min-h-20 resize-y py-2" : "h-control-md",
          )}
        />
        {errors?.[active] ? (
          <p className="flex items-center gap-1 text-caption text-danger">
            <WarningCircle aria-hidden="true" weight="fill" className="size-[1.1em]" />
            {errors[active]}
          </p>
        ) : state(active) === "fallback" ? (
          <p className="text-caption text-fg-subtle">{t("localeFallback", { language: NATIVE[fallback] })}</p>
        ) : description ? (
          <p className="text-caption text-fg-muted">{description}</p>
        ) : null}
        </BaseTabs.Panel>
      </BaseTabs.Root>
    </div>
  );
}
