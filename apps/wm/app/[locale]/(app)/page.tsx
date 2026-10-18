"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChatCircleText, ClockCountdown, FileText, Globe, Image, Lightbulb, MagnifyingGlass, PencilSimple, Translate } from "@phosphor-icons/react";
import { Card, ErrorState, PageHeader, Skeleton, useFormatter } from "@orgtik/ui";
import { useMeQuery, useOverviewQuery, type Overview } from "@/store/api";
import { Link } from "@/i18n/routing";
import { WebsiteNumbers } from "@/components/overview/WebsiteNumbers";

const QUEUE: { key: keyof Overview["queue"]; icon: React.ReactNode }[] = [
  { key: "drafts", icon: <PencilSimple /> },
  { key: "inReview", icon: <FileText /> },
  { key: "scheduled", icon: <ClockCountdown /> },
  { key: "translationGaps", icon: <Translate /> },
  { key: "seoIssues", icon: <MagnifyingGlass /> },
  { key: "mediaIssues", icon: <Image /> },
  { key: "newLeads", icon: <ChatCircleText /> },
  { key: "pendingIdeas", icon: <Lightbulb /> },
  { key: "translationReview", icon: <Translate /> },
];

const DESTINATIONS: Partial<Record<keyof Overview["queue"], string>> = {
  drafts: "/content/queue?state=draft&mine=1", inReview: "/content/queue?state=in_review", scheduled: "/content/queue?state=scheduled",
  translationGaps: "/localization?status=gaps", translationReview: "/localization?status=needs_review", seoIssues: "/seo?issue=descriptionMissing", mediaIssues: "/media?issue=attention", newLeads: "/marketing/leads?status=new", pendingIdeas: "/marketing/ideas?status=pending",
};
export default function OverviewPage() {
  const t = useTranslations("Overview");
  const tr = useTranslations("Roles");
  const locale = useLocale();
  const f = useFormatter();
  const me = useMeQuery();
  const { data, isLoading, isError, refetch } = useOverviewQuery();
  // Each language joins a list its own way ("Admin and Editor", «مسؤول ومحرر»).
  const roles = new Intl.ListFormat(locale, { type: "conjunction" }).format(me.data?.roles.map((r) => (tr.has(r.key) ? tr(r.key) : r.label)) ?? []);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("description")} status={<span className="inline-flex items-center gap-1.5 text-body-sm text-fg-muted"><Globe aria-hidden="true" className="size-4" />{t("yourRoles", { roles })}</span>} />
      <section aria-labelledby="queue-heading" aria-busy={isLoading || undefined} className="flex flex-col gap-4">
        <h2 id="queue-heading" className="font-display text-title-sm text-fg">{t("queue")}</h2>
        {isError ? (
          <Card><ErrorState size="compact" onRetry={refetch} /></Card>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(13rem,100%),1fr))] gap-3">
            {QUEUE.map(({ key, icon }) => (
              <li key={key}>
                <Link href={DESTINATIONS[key] ?? "/content/queue"} className="block rounded-card focus-visible:outline-2 focus-visible:outline-focus"><Card padding="sm" className="flex items-center gap-3 transition-colors hover:bg-hover">
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-field bg-brand-subtle text-fg-brand [&_svg]:size-5">{icon}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-sm text-fg-muted">{t(key)}</span>
                    {isLoading || !data ? <Skeleton className="mt-1 h-5 w-8" /> : <span className="font-display text-title text-fg tabular-nums">{f.number(data.queue[key])}</span>}
                  </span>
                </Card></Link>
              </li>
            ))}
          </ul>
        )}
        {data && Object.values(data.queue).every((n) => n === 0) ? <p className="text-body text-fg-muted">{t("nothingWaiting")}</p> : null}
      </section>
      <WebsiteNumbers />
    </div>
  );
}
