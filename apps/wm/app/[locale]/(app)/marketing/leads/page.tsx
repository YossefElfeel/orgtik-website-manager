"use client";
import { RowActionsMenu } from "@/components/content/RowActionsMenu";


import { Link, useRouter } from "@/i18n/routing";
import { useListState } from "@/lib/useListState";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { DownloadSimple, Eye, PencilSimple, MagnifyingGlass, X } from "@phosphor-icons/react";
import { Badge, Button, Input, MenuLinkItem, PageHeader, StatusBadge, Select, Tabs, TabsList, toast, useFormatter, useStatusLabel } from "@orgtik/ui";
import { DataTable, type ColumnDef } from "@orgtik/ui/table";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { useCan } from "@/lib/permissions";
import { downloadLeads, statusOf, useLeadsQuery, type Lead } from "@/store/api";

const TABS = ["new", "open", "contacted", "qualified", "quoted", "won", "closed"] as const;
type Tab = (typeof TABS)[number];
function LeadsList() {
  const t = useTranslations("Leads");
  const f = useFormatter();
  const can = useCan();
  const statusLabel = useStatusLabel();

  const url = useListState();
  const router = useRouter();
  const ti = useTranslations("Improvements");
  const search = url.get("search");
  const setSearch = (search: string) => url.set({ search });
  const tab = (url.get("status", "new")) as Tab;
  const setTab = (status: Tab) => url.set({ status });
  const { data, isLoading, error, refetch, isFetching } = useLeadsQuery({ status: tab, search: search || undefined, page: url.page, pageSize: 10 });
  const counts = data?.counts ?? {};
  const countOf = (x: Tab) =>
    x === "open" ? (["contacted", "qualified", "quoted"] as const).reduce((n, k) => n + (counts[k] ?? 0), 0) : x === "closed" ? (["lost", "unqualified", "spam", "duplicate"] as const).reduce((n, k) => n + (counts[k] ?? 0), 0) : counts[x] ?? 0;

  const columns = useMemo<ColumnDef<Lead, any>[]>(
    () => [
      {
        id: "lead",
        header: t("colLead"),
        meta: { truncate: true },
        cell: ({ row }) => {
          const l = row.original;
          return (
            <span className="flex min-w-0 flex-col items-start">
              <span className="flex max-w-full items-center gap-2">
                <Link dir="auto" href={`/marketing/leads/${l.id}?returnTo=${encodeURIComponent(url.href)}`} className="truncate text-start font-semibold text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus">
                  {l.erased ? t("erasedName") : l.name}
                </Link>
                {l.sample ? <Badge size="sm">{t("sample")}</Badge> : null}
              </span>
              <span dir="auto" className="max-w-full truncate text-caption text-fg-subtle">{l.message}</span>
            </span>
          );
        },
      },
      { id: "topic", header: t("colTopic"), cell: ({ row }) => <span dir="auto" className="text-fg-muted">{row.original.topic}</span> },
      { id: "from", header: t("colFrom"), cell: ({ row }) => <span dir="ltr" className="font-mono text-caption text-fg-muted">{row.original.page}{row.original.utm.source ? ` · ${row.original.utm.source}` : ""}</span> },
      { id: "owner", header: t("owner"), cell: ({ row }) => <span className="text-fg-muted"><bdi dir="auto">{row.original.owner?.name ?? t("noOwner")}</bdi></span> },
      { id: "created", header: t("colCreated"), meta: { numeric: true }, cell: ({ row }) => <span className="text-fg-muted">{f.date(row.original.createdAt, { dateStyle: "medium" })}</span> },
      { id: "status", header: t("colStatus"), cell: ({ row }) => <StatusBadge entity="lead" state={row.original.status} size="sm" /> },
      { id: "actions", header: ti("actions"), enableSorting: false, cell: ({ row }) => <RowActionsMenu target={row.original.name}><MenuLinkItem icon={<Eye />} render={<Link href={`/marketing/leads/${row.original.id}?returnTo=${encodeURIComponent(url.href)}`} />}>{ti("view")}</MenuLinkItem>{can("marketing:edit") ? <MenuLinkItem icon={<PencilSimple />} render={<Link href={`/marketing/leads/${row.original.id}?edit=1&returnTo=${encodeURIComponent(url.href)}`} />}>{ti("edit")}</MenuLinkItem> : null}</RowActionsMenu> },
    ],
    [t, ti, f, can, router, url.href],
  );
  const status = isLoading ? "loading" : error ? (statusOf(error) === 403 ? "forbidden" : "error") : "ready";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="secondary" startIcon={<DownloadSimple />} onClick={() => downloadLeads().catch(() => toast.error(t("failed")))}>
            {data?.pii ? t("export") : t("exportMasked")}
          </Button>
        }
      />
      <div className="wm-table-filters"><Input size="sm" type="search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("search")} placeholder={data?.pii ? t("search") : t("searchMasked")} startIcon={<MagnifyingGlass className="size-4" />} className="wm-search" /><Select size="sm" aria-label={t("title")} value={tab} onValueChange={value=>setTab((value??"open") as Tab)} options={TABS.map(value=>({value,label:value==="open"?ti("opened"):value==="closed"?t("closed"):statusLabel("lead",value)}))} /></div>
      <DataTable
        mode="server"
        rowCount={data?.total ?? 0}
        pagination={{ pageIndex: url.page - 1, pageSize: 10 }}
        onPaginationChange={update => url.set({ page: (typeof update === "function" ? update({ pageIndex: url.page - 1, pageSize: 10 }) : update).pageIndex + 1 })}
        label={t("title")}
        columns={columns.map(column => ({ ...column, enableSorting: false }))}
        data={data?.items ?? []}
        getRowId={(r) => r.id}
        status={status}
        paginate
        onRetry={refetch}
        className={isFetching && !isLoading ? "opacity-70" : undefined}
        empty={search ? { title: t("noMatch"), action: <Button size="sm" variant="secondary" startIcon={<X />} onClick={() => setSearch("")}>{t("clear")}</Button> } : { title: t(`empty.${tab}`) }}
      />

    </div>
  );
}

export default function LeadsPage() {
  return (
    <RequirePermission permission="marketing:view">
      <LeadsList />
    </RequirePermission>
  );
}
