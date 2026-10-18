"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge, Card, Input, Select, PageHeader, Tabs, TabsList, useFormatter } from "@orgtik/ui";
import { DataTable, type ColumnDef } from "@orgtik/ui/table";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { Link } from "@/i18n/routing";
import { useListState } from "@/lib/useListState";
import { TYPES } from "@/lib/contentTypes";
import { useEntryName } from "@/lib/entryName";
import { statusOf, useSeoHealthQuery, type SeoCheck, type SeoRow } from "@/store/api";

const CHECKS: SeoCheck[] = ["descriptionMissing", "descriptionShort", "descriptionLong", "titleMissing", "titleLong", "titleDuplicate", "noSocialImage", "imageNoAlt"];

// What a search result and a shared link need, page by page: a checklist, not a score.
function Health() {
  const t = useTranslations("Seo");
  const tt = useTranslations("Types");
  const f = useFormatter();
  const entryName = useEntryName();
  const ti = useTranslations("Improvements");
  const url = useListState();
  const check = url.get("issue", "all") as "all" | SeoCheck;
  const setCheck = (issue: string) => url.set({ issue });
  const { data, isLoading, error, refetch, isFetching } = useSeoHealthQuery({ issue: check === "all" ? undefined : check, search: url.get("search"), kind: url.get("kind"), page: url.page, pageSize: 10 });
  const counts = data?.counts;

  const columns = useMemo<ColumnDef<SeoRow, any>[]>(
    () => [
      {
        id: "page",
        header: t("colPage"),
        meta: { truncate: true },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="flex min-w-0 flex-col">
              <Link href={`/seo/content/${r.id}?lang=${r.locale}&returnTo=${encodeURIComponent(url.href)}`} dir="auto" className="truncate font-semibold text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus">
                {entryName(r)}
              </Link>
              <span dir="ltr" className="truncate text-start font-mono text-caption text-fg-subtle">{r.path}</span>
            </span>
          );
        },
      },
      { id: "type", header: t("colType"), cell: ({ row }) => <span className="text-fg-muted">{tt(`${row.original.type}.one`)}</span> },
      { id: "title", header: t("colTitle"), meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums text-fg-muted">{f.number(row.original.titleLength)}</span> },
      { id: "description", header: t("colDescription"), meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums text-fg-muted">{f.number(row.original.descriptionLength)}</span> },
      {
        id: "issues",
        header: t("colIssues"),
        cell: ({ row }) =>
          row.original.issues.length ? (
            <span className="flex flex-wrap gap-1">
              {row.original.issues.map((i) => (
                <Badge key={i} size="sm" tone={i.startsWith("description") || i.startsWith("title") ? "warning" : "neutral"}>{t(`checks.${i}`)}</Badge>
              ))}
            </span>
          ) : (
            <Badge size="sm" tone="success">{t("ok")}</Badge>
          ),
      },
    ],
    [t, tt, f, entryName, url.href],
  );

  const status = isLoading ? "loading" : error ? (statusOf(error) === 403 ? "forbidden" : "error") : "ready";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("healthTitle")} description={t("healthDescription")} />
      {data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Card padding="sm" className="flex flex-col">
            <span className="text-body-sm text-fg-muted">{t("checked")}</span>
            <span className="font-display text-title text-fg tabular-nums">{f.number(data.checked)}</span>
          </Card>
          <Card padding="sm" className="flex flex-col">
            <span className="text-body-sm text-fg-muted">{t("healthy")}</span>
            <span className="font-display text-title text-fg tabular-nums">{f.number(data.healthy)}</span>
          </Card>
          <Card padding="sm" className="flex flex-col">
            <span className="text-body-sm text-fg-muted">{t("checks.descriptionMissing")}</span>
            <span className="font-display text-title text-fg tabular-nums">{f.number(data.counts.descriptionMissing)}</span>
          </Card>
          <Card padding="sm" className="flex flex-col">
            <span className="text-body-sm text-fg-muted">{t("checks.noSocialImage")}</span>
            <span className="font-display text-title text-fg tabular-nums">{f.number(data.counts.noSocialImage)}</span>
          </Card>
        </div>
      ) : null}
      <div className="wm-table-filters"><Select size="sm" aria-label={t("healthTitle")} value={check} onValueChange={value=>setCheck((value??"all") as SeoCheck|"all")} options={[{value:"all",label:t("all")},...CHECKS.map(value=>({value,label:t(`checks.${value}`)}))]} />
        <Input size="sm" aria-label={ti("search")} placeholder={ti("search")} value={url.get("search")} onChange={e => url.set({ search: e.target.value })} className="wm-search" />
        <Select size="sm" label={ti("type")} value={url.get("kind", "all")} onValueChange={kind => url.set({ kind })} options={[{ value: "all", label: ti("all") }, ...Object.values(TYPES).filter(type => type.seo).map(type => ({ value: type.key, label: tt(`${type.key}.many`) }))]} />
      </div>
      <DataTable
        label={t("healthTitle")}
        columns={columns.map(column => ({ ...column, enableSorting: false }))}
        mode="server" rowCount={data?.total ?? 0}
        pagination={{ pageIndex: url.page - 1, pageSize: 10 }}
        onPaginationChange={update => url.set({ page: (typeof update === "function" ? update({ pageIndex: url.page - 1, pageSize: 10 }) : update).pageIndex + 1 })}
        data={data?.items ?? []}
        getRowId={(r) => `${r.id}-${r.locale}`}
        status={status}
        paginate
        onRetry={refetch}
        className={isFetching && !isLoading ? "opacity-70" : undefined}
        empty={{ title: t("allGood") }}
      />
    </div>
  );
}

export default function SeoHealthPage() {
  return (
    <RequirePermission permission="seo:view">
      <Health />
    </RequirePermission>
  );
}
