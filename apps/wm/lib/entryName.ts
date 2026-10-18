"use client";
import { useCallback } from "react";
import { useTranslations } from "next-intl";

/**
 * What the screens call an entry. Pages and Global are templates, so their names are the UI's
 * (messages EntryNames.<id>, in the person's language); everything else is named by its content.
 */
export function useEntryName() {
  const t = useTranslations("EntryNames");
  return useCallback((e: { id: string; name: string }) => (t.has(e.id) ? t(e.id) : e.name), [t]);
}
