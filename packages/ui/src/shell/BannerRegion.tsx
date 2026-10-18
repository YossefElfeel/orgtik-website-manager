"use client";
import type { ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
import { STATUS_MATRIX } from "../status/matrix.js";
import { STATUS_ICONS } from "../status/icons.js";

type BannerKind = keyof typeof STATUS_MATRIX.banner;

export type Banner = {
  /** The banner's state in the status matrix; it sets the priority, tone, icon and default title. */
  kind: BannerKind;
  /** Overrides the matrix label, e.g. with the date: "Trial ends in 2 days". */
  title?: ReactNode;
  description?: ReactNode;
  /** The one next step, e.g. <Button size="sm">Pay now</Button>. */
  action?: ReactNode;
  onDismiss?: () => void;
};

// D-026: the matrix lists banner states in priority order (blocking first).
const PRIORITY = Object.keys(STATUS_MATRIX.banner) as BannerKind[];

const TONE: Record<string, string> = {
  danger: "bg-danger-subtle text-danger",
  warning: "bg-warning-subtle text-warning",
  info: "bg-info-subtle text-info",
  neutral: "bg-sunken text-fg-muted",
  // The staff ribbon sits on chrome, dark in both themes, inside a dark theme scope (see Strip).
  brand: "bg-chrome text-fg-on-chrome [&_svg]:text-fg-brand",
};

function Strip({ banner, className }: { banner: Banner; className?: string }) {
  const { locale } = useOrgtik();
  const t = useStrings();
  const entry = STATUS_MATRIX.banner[banner.kind] as { tone: string; icon: string | null; label: Record<string, string> };
  const Icon = entry.icon ? STATUS_ICONS[entry.icon] : null;
  const urgent = entry.tone === "danger";
  // A strip on the dark chrome gets the dark theme's tokens, so the action placed in it (a
  // secondary Button, a link) keeps its contrast in both themes.
  const scope = entry.tone === "brand" ? "dark" : undefined;
  return (
    <div role={urgent ? "alert" : "status"} data-banner={banner.kind} data-theme={scope} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-body-sm", TONE[entry.tone], className)}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {Icon ? <Icon aria-hidden="true" weight="fill" className="mt-[0.15em] size-[1.15em] shrink-0" /> : null}
        <p className="min-w-0">
          <span className="font-semibold">{banner.title ?? entry.label[locale] ?? entry.label.en}</span>
          {banner.description ? <span className="opacity-90"> {banner.description}</span> : null}
        </p>
      </div>
      {banner.action ? <div className="flex shrink-0 items-center gap-2">{banner.action}</div> : null}
      {banner.onDismiss ? (
        <button
          type="button"
          onClick={banner.onDismiss}
          aria-label={t("dismiss")}
          className="grid size-7 shrink-0 place-items-center rounded-pill hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The one banner slot: pass every banner that applies and it shows the most urgent one (D-026).
 * "Viewing as customer" is a separate ribbon that always shows for staff (D-017).
 */
export function BannerRegion({ banners, className }: { banners: Banner[]; className?: string }) {
  const ribbon = banners.find((b) => b.kind === "staff_viewing");
  const top = banners
    .filter((b) => b.kind !== "staff_viewing")
    .sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))[0];
  if (!ribbon && !top) return null;
  return (
    <div className={cn("flex flex-col", className)}>
      {ribbon ? <Strip banner={ribbon} className="py-1.5" /> : null}
      {top ? <Strip banner={top} /> : null}
    </div>
  );
}
