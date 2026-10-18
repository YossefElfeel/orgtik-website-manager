"use client";
import { RowActionsMenu } from "@/components/content/RowActionsMenu";

import { ActionDialog, NEXT } from "@/components/marketing/IdeaDetail";
import { Link } from "@/i18n/routing";
import { useListState } from "@/lib/useListState";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, PencilSimple, MagnifyingGlass, X } from "@phosphor-icons/react";
import { Badge, Button, Input, Select, MenuItem, MenuLinkItem, PageHeader, StatusBadge, useFormatter, useStatusLabel } from "@orgtik/ui";
import { DataTable, type ColumnDef } from "@orgtik/ui/table";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { useCan } from "@/lib/permissions";
import { statusOf, useIdeasQuery, type Idea, type IdeaAction } from "@/store/api";

// The tabs: what needs a decision first, then the public lifecycle, then everything closed.
const TABS = ["all", "pending", "open", "planned", "in_progress", "shipped", "closed"] as const;
type Tab = (typeof TABS)[number];
function IdeasList() {
  const t = useTranslations("Ideas");
  const f = useFormatter();
  const statusLabel = useStatusLabel();
  const can = useCan();
  const canModerate = can("marketing:edit");

  const url = useListState();
  const ti = useTranslations("Improvements");
  const search = url.get("search");
  const setSearch = (search: string) => url.set({ search });
  const tab = (url.get("status", "all")) as Tab;
  const setTab = (status: Tab) => url.set({ status });
  const [acting, setActing] = useState<{ idea: Idea; action: IdeaAction } | null>(null);
  const { data, isLoading, error, refetch, isFetching } = useIdeasQuery({ status: tab, search: search || undefined, page: url.page, pageSize: 10 });

  const columns = useMemo<ColumnDef<Idea, any>[]>(
    () => [
      {
        id: "idea",
        header: t("colIdea"),
        cell: ({ row }) => {
          const x = row.original;
          return (
            <span className="flex min-w-0 flex-col items-start">
              <span className="flex max-w-full flex-wrap items-center gap-2">
                <Link dir="auto" href={`/marketing/ideas/${x.id}?returnTo=${encodeURIComponent(url.href)}`} className="break-words text-start font-semibold text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus">
                  {x.title}
                </Link>
                {x.sample ? <Badge size="sm">{t("sample")}</Badge> : null}
              </span>
              <span dir="auto" className="max-w-full truncate text-caption text-fg-subtle">{x.body}</span>
            </span>
          );
        },
      },
      { id: "theme", header: t("colTheme"), cell: ({ row }) => <span dir="auto" className="text-fg-muted">{row.original.theme}</span> },
      { id: "votes", header: t("colVotes"), meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{f.number(row.original.votes)}</span> },
      { id: "submitted", header: t("colSubmitted"), meta: { numeric: true }, cell: ({ row }) => <span className="text-fg-muted">{f.date(row.original.submittedAt, { dateStyle: "medium" })}</span> },
      { id: "status", header: t("colStatus"), cell: ({ row }) => <StatusBadge entity="roadmap_idea" state={row.original.status} size="sm" /> },
      { id: "actions", header: ti("actions"), enableSorting: false, cell: ({ row }) => <RowActionsMenu target={row.original.title}>
          <MenuLinkItem icon={<Eye />} render={<Link href={`/marketing/ideas/${row.original.id}?returnTo=${encodeURIComponent(url.href)}`} />}>{ti("view")}</MenuLinkItem>
          {canModerate ? <MenuLinkItem icon={<PencilSimple />} render={<Link href={`/marketing/ideas/${row.original.id}?edit=1&returnTo=${encodeURIComponent(url.href)}`} />}>{ti("edit")}</MenuLinkItem> : null}
          {canModerate && (NEXT[row.original.status] ?? []).includes("merge") ? <MenuItem onClick={() => setActing({ idea: row.original, action: "merge" })}>{t("actions.merge")}</MenuItem> : null}
          {canModerate && (NEXT[row.original.status] ?? []).includes("hide") ? <MenuItem tone="danger" onClick={() => setActing({ idea: row.original, action: "hide" })}>{t("actions.hide")}</MenuItem> : null}
        </RowActionsMenu> },
    ],
    [t, ti, f, canModerate, url.href],
  );

  const status = isLoading ? "loading" : error ? (statusOf(error) === 403 ? "forbidden" : "error") : "ready";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="wm-table-filters"><Input
        size="sm"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={t("search")}
        placeholder={t("search")}
        startIcon={<MagnifyingGlass className="size-4" />}
        className="wm-search"
      /><Select size="sm" aria-label={t("colStatus")} value={tab} onValueChange={value=>setTab((value??"all") as Tab)} options={TABS.map(value=>({value,label:value === "all" ? t("all") : value === "closed" ? t("closed") : value === "open" ? ti("opened") : statusLabel("roadmap_idea",value)}))} /></div>
      <DataTable
        mode="server"
        rowCount={data?.total ?? 0}
        pagination={{ pageIndex: url.page - 1, pageSize: 10 }}
        onPaginationChange={update => url.set({ page: (typeof update === "function" ? update({ pageIndex: url.page - 1, pageSize: 10 }) : update).pageIndex + 1 })}
        label={t("tableLabel")}
        columns={columns.map(column => ({ ...column, enableSorting: false }))}
        data={data?.items ?? []}
        getRowId={(r) => r.id}
        status={status}
        paginate
        onRetry={refetch}
        className={isFetching && !isLoading ? "opacity-70" : undefined}
        empty={
          search
            ? {
                title: t("noMatch"),
                action: (
                  <Button size="sm" variant="secondary" startIcon={<X />} onClick={() => setSearch("")}>
                    {t("clear")}
                  </Button>
                ),
              }
            : { title: t(`empty.${tab}`) }
        }
      />

      {acting ? <ActionDialog idea={acting.idea} action={acting.action} onClose={() => setActing(null)} /> : null}
    </div>
  );
}

export default function IdeasPage() {
  return (
    <RequirePermission permission="marketing:view">
      <IdeasList />
    </RequirePermission>
  );
}
