"use client";

import { Info } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

export function PricingAuthority({ historical = false }: { historical?: boolean }) {
  const t = useTranslations("Editor");
  return <aside role="note" className="flex items-start gap-3 rounded-card border border-line bg-raised px-4 py-3">
    <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" />
    <div className="min-w-0 space-y-1">
      <p className="text-body-sm font-semibold text-fg">{t("platformPricingTitle")}</p>
      <p className="text-body-sm text-fg-muted">{t(historical ? "historicalPricingBody" : "platformPricingBody")}</p>
    </div>
  </aside>;
}
