"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChatCircleText,
  Eye,
  Flask,
  Percent,
  UsersThree,
} from "@phosphor-icons/react";
import {
  Badge,
  Card,
  ErrorState,
  SegmentedControl,
  Stat,
  useFormatter,
} from "@orgtik/ui";
import { RankingChart } from "./RankingChart";
import { TopicsChart, VisitsChart } from "./OverviewCharts";
import { Link } from "@/i18n/routing";
import { mediaUrl } from "@/lib/env";
import { useAnalyticsQuery, type AnalyticsPeriod } from "@/store/api";

/**
 * The website's numbers (parity with the old dashboard's overview: KPIs, visits against the
 * previous period, top services and articles, article views by topic). The mock has no analytics
 * source yet, so every figure here is marked as a sample.
 */
export function WebsiteNumbers() {
  const t = useTranslations("Overview");
  const f = useFormatter();
  const ti = useTranslations("Improvements");
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { data, isLoading, isError, refetch } = useAnalyticsQuery(period);
  const change = (now: number, before: number) =>
    before ? now / before - 1 : 0;
  const against = t(`against.${period}`);
  const bucket = (v: string | number) => {
    const s = String(v);
    if (data?.bucket === "month")
      return f.date(`${s}-01T00:00:00`, { month: "short", year: "2-digit" });
    return f.date(`${s}T00:00:00`, { day: "numeric", month: "short" });
  };

  return (
    <section aria-labelledby="site-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="site-heading" className="font-display text-title-sm text-fg">
            {t("website")}
          </h2>
          {data?.sample ? (
            <Badge tone="warning" icon={<Flask weight="bold" />}>
              {t("sample")}
            </Badge>
          ) : null}
        </div>
        <SegmentedControl
          size="sm"
          label={t("period")}
          value={period}
          onValueChange={setPeriod}
          segments={(["30d", "90d", "12m"] as const).map((p) => ({
            value: p,
            label: t(`periods.${p}`),
          }))}
        />
      </div>
      {data?.sample ? (
        <p className="-mt-2 text-body-sm text-fg-muted">{t("sampleBody")}</p>
      ) : null}

      {isError ? (
        <Card>
          <ErrorState size="compact" onRetry={refetch} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Stat
              loading={isLoading}
              icon={<Eye />}
              label={t("visits")}
              value={data ? f.number(data.totals.visits) : ""}
              change={
                data
                  ? {
                      value: change(data.totals.visits, data.previous.visits),
                      against,
                    }
                  : undefined
              }
            />
            <Stat
              loading={isLoading}
              icon={<UsersThree />}
              label={t("visitors")}
              value={data ? f.number(data.totals.visitors) : ""}
              change={
                data
                  ? {
                      value: change(
                        data.totals.visitors,
                        data.previous.visitors,
                      ),
                      against,
                    }
                  : undefined
              }
            />
            <Stat
              loading={isLoading}
              icon={<ChatCircleText />}
              label={t("leadsSample")}
              value={data ? f.number(data.totals.leads) : ""}
              change={
                data
                  ? {
                      value: change(data.totals.leads, data.previous.leads),
                      against,
                    }
                  : undefined
              }
              hint={
                data ? t("realLeads", { count: data.realLeads }) : undefined
              }
            />
            <Stat
              loading={isLoading}
              icon={<Percent />}
              label={t("conversion")}
              value={data ? f.percent(data.totals.conversion, 1) : ""}
              change={
                data
                  ? {
                      value: change(
                        data.totals.conversion,
                        data.previous.conversion,
                      ),
                      against,
                    }
                  : undefined
              }
              hint={t("conversionHint")}
            />
          </div>

          <VisitsChart
            loading={isLoading}
            title={t("visitsChart")}
            description={t(`periodLong.${period}`)}
            data={data?.series ?? []}
            periodLabel={t(`bucket.${data?.bucket ?? "day"}`)}
            formatPeriod={bucket}
            currentLabel={t("thisPeriod")}
            previousLabel={t("previousPeriod")}
          />

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <RankingChart
              loading={isLoading}
              title={t("topPages")}
              label={t("page")}
              valueLabel={t("visits")}
              rows={(data?.pages ?? []).map((row) => ({
                label: row.path,
                value: row.visits,
              }))}
            />
            <RankingChart
              loading={isLoading}
              title={t("topServices")}
              description={t("topServicesHint")}
              label={t("service")}
              valueLabel={t("leadsSample")}
              rows={(data?.services ?? []).map((row) => ({
                label:
                  row.id === "software-system"
                    ? ti("softwareSystem")
                    : row.name,
                value: row.leads,
              }))}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="flex min-w-0 flex-col gap-5">
              <header className="flex min-h-16 flex-col gap-1">
                <h3 className="font-display text-title-sm text-fg">
                  {t("topArticles")}
                </h3>
                <p className="text-body-sm text-fg-muted">
                  {t("articleViews")}
                </p>
              </header>
              {isLoading || !data ? null : (
                <ol className="flex flex-col divide-y divide-line">
                  {data.articles.map((a) => (
                    <li
                      key={a.path}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      {a.image ? (
                        <img
                          src={mediaUrl(a.image)}
                          alt=""
                          className="size-12 shrink-0 rounded-field object-cover"
                        />
                      ) : null}
                      <span className="flex min-w-0 flex-1 flex-col">
                        {a.id ? (
                          <Link
                            href={`/content/insights/${a.id}`}
                            className="truncate text-body text-fg hover:text-fg-brand"
                          >
                            {a.title}
                          </Link>
                        ) : (
                          <span className="truncate text-body text-fg">
                            {a.title}
                          </span>
                        )}
                        <span
                          dir="ltr"
                          className="truncate text-start text-caption text-fg-subtle"
                        >
                          {a.path}
                        </span>
                      </span>
                      <span className="shrink-0 text-body-sm text-fg-muted tabular-nums">
                        {t("views", { count: a.views })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <TopicsChart
              loading={isLoading}
              title={t("byTopic")}
              categoryLabel={t("topic")}
              valueLabel={t("articleViews")}
              data={data?.topics ?? []}
            />
          </div>
        </>
      )}
    </section>
  );
}
