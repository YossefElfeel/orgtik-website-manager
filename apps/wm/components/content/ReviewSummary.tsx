"use client";

import { useLocale, useTranslations } from "next-intl";
import { UserCircle } from "@phosphor-icons/react";
import { Badge, Skeleton } from "@orgtik/ui";
import { Link } from "@/i18n/routing";
import { mediaUrl } from "@/lib/env";
import { VisibilityBadge } from "./Lifecycle";
import { useEntryQuery, type EntrySummary, type Locale } from "@/store/api";

export function ReviewSummary({
  entry,
  href,
}: {
  entry: EntrySummary;
  href: string;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("Improvements");
  const { data, isFetching, isError } = useEntryQuery({
    type: "review",
    id: entry.id,
  });
  const words = data?.content.locales[locale] ?? data?.content.locales.en;
  const text = (key: string) =>
    typeof words?.[key] === "string" ? (words[key] as string) : "";
  return (
    <div className="flex min-w-0 items-start gap-3 py-1">
      {entry.image?.src ? (
        <img
          src={mediaUrl(entry.image.src)}
          alt=""
          className="size-11 shrink-0 rounded-pill bg-sunken object-cover"
          style={{
            objectPosition: `${entry.image.focal?.x ?? 50}% ${entry.image.focal?.y ?? 50}%`,
          }}
        />
      ) : (
        <UserCircle aria-hidden className="size-11 shrink-0 text-fg-muted" />
      )}
      <div className="flex min-w-0 max-w-prose flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href}
            dir="auto"
            className="font-semibold text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {text("name") || entry.name}
          </Link>
          {data?.content.sample ? (
            <Badge tone="warning" size="sm">
              {t("sample")}
            </Badge>
          ) : null}
        </div>
        <span className="inline-flex self-start">
          {entry.visibility === "live" ? (
            <Badge tone="success" size="sm">
              {t("reviewLive")}
            </Badge>
          ) : (
            <VisibilityBadge entry={entry} />
          )}
        </span>
        {isFetching && !data ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <>
            {[text("role"), text("company")].filter(Boolean).length ? (
              <span dir="auto" className="text-caption text-fg-muted">
                {[text("role"), text("company")].filter(Boolean).join(" · ")}
              </span>
            ) : null}
            {text("quote") ? (
              <p
                dir="auto"
                className="line-clamp-2 whitespace-normal text-body-sm text-fg-muted"
              >
                {text("quote")}
              </p>
            ) : (
              <span className="text-caption text-fg-muted">
                {t(isError ? "reviewSummaryUnavailable" : "reviewQuoteEmpty")}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ReviewOrder({ entry }: { entry: EntrySummary }) {
  const { data } = useEntryQuery({ type: "review", id: entry.id });
  return data ? (
    <span className="tabular-nums">{data.content.position ?? entry.order}</span>
  ) : (
    <Skeleton className="h-4 w-8" />
  );
}
