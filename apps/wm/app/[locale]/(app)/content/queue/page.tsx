"use client";
import { useTranslations } from "next-intl";
import { Input, PageHeader, Select, StatusBadge } from "@orgtik/ui";
import { DataTable, type ColumnDef } from "@orgtik/ui/table";
import { EntryActions } from "@/components/content/EntryActions";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { TYPES } from "@/lib/contentTypes";
import { useEntryName } from "@/lib/entryName";
import { useListState } from "@/lib/useListState";
import { useCan } from "@/lib/permissions";
import { Link } from "@/i18n/routing";
import { useContentQueueQuery, type EntrySummary } from "@/store/api";

function Queue() {
  const can = useCan();
  const t = useTranslations("Improvements"),
    tt = useTranslations("Types"),
    to = useTranslations("Overview");
  const url = useListState();
  const name = useEntryName();
  const query = useContentQueueQuery({
    state: url.get("state"),
    mine: url.get("mine"),
    search: url.get("search"),
    page: url.page,
    pageSize: 10,
  });
  const columns: ColumnDef<EntrySummary>[] = [
    {
      id: "name",
      header: t("name"),
      cell: ({ row }) => (
        <Link
          className="font-semibold hover:underline"
          href={`/content/${TYPES[row.original.type].area}/${row.original.id}?${can("content:edit") ? "" : "view=1&"}returnTo=${encodeURIComponent(url.href)}`}
        >
          {name(row.original)}
        </Link>
      ),
    },
    {
      id: "type",
      header: t("type"),
      cell: ({ row }) => tt(`${row.original.type}.one`),
    },
    {
      id: "state",
      header: t("status"),
      cell: ({ row }) => (
        <StatusBadge entity="cms_revision" state={row.original.state} />
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <EntryActions entry={row.original} returnTo={url.href} />
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={to("queue")} description={t("queueHelp")} />
      <div className="wm-table-filters">
        <Input
          className="wm-search"
          aria-label={t("search")}
          placeholder={t("search")}
          value={url.get("search")}
          onChange={(e) => url.set({ search: e.target.value })}
        />
        <Select
          label={t("status")}
          value={url.get("state", "all")}
          onValueChange={(state) => url.set({ state })}
          options={[
            { value: "all", label: t("all") },
            ...(
              [
                "draft",
                "in_review",
                "approved",
                "scheduled",
                "published",
              ] as const
            ).map((value) => ({
              value,
              label: <StatusBadge entity="cms_revision" state={value} />,
            })),
          ]}
        />
      </div>
      <DataTable
        empty={{ title: t("noResults") }}
        label={to("queue")}
        columns={columns.map((column) => ({ ...column, enableSorting: false }))}
        data={query.data?.items ?? []}
        getRowId={(row) => row.id}
        mode="server"
        rowCount={query.data?.total ?? 0}
        pagination={{ pageIndex: url.page - 1, pageSize: 10 }}
        onPaginationChange={(update) =>
          url.set({
            page:
              (typeof update === "function"
                ? update({ pageIndex: url.page - 1, pageSize: 10 })
                : update
              ).pageIndex + 1,
          })
        }
        status={query.isLoading ? "loading" : query.error ? "error" : "ready"}
        onRetry={query.refetch}
      />
    </div>
  );
}
export default function QueuePage() {
  return (
    <RequirePermission permission="content:view">
      <Queue />
    </RequirePermission>
  );
}
