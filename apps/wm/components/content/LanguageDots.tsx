"use client";

import { useTranslations } from "next-intl";
import { cn } from "@orgtik/ui";
import { useSiteQuery, type Locale, type TranslationState } from "@/store/api";

const ORDER: Locale[] = ["en", "ar", "de", "fr", "it"];
const DONE: TranslationState[] = ["ready", "published"];

/** Five small marks, one per language, filled when that language is ready; the count is spoken. */
export function LanguageDots({ translation }: { translation: Record<Locale, TranslationState> }) {
  const t = useTranslations("Editor");
  const site = useSiteQuery();
  const languages = site.data?.locales.filter(locale=>locale.enabled).map(locale=>locale.code) ?? ORDER;
  const done = languages.filter((l) => DONE.includes(translation[l])).length;
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="flex gap-1">
        {languages.map((l) => (
          <span
            key={l}
            title={`${l.toUpperCase()}: ${translation[l]}`}
            className={cn("size-2 rounded-pill", DONE.includes(translation[l]) ? "bg-success-solid" : translation[l] === "outdated" ? "bg-warning-solid" : "bg-line-strong")}
          />
        ))}
      </span>
      <span className="text-caption text-fg-muted tabular-nums">{t("languagesDone", { done, total: languages.length })}</span>
    </span>
  );
}
