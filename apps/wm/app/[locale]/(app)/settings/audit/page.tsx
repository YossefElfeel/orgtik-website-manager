"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input, PageHeader, Select, useFormatter } from "@orgtik/ui";
import { DataTable, type ColumnDef } from "@orgtik/ui/table";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { Link } from "@/i18n/routing";
import { useListState } from "@/lib/useListState";
import { typeOfId } from "@/lib/contentTypes";
import { statusOf, useAuditQuery, useMembersQuery, type AuditEvent } from "@/store/api";

const KINDS = ["all", "content", "media", "redirect", "idea", "lead", "settings", "user"] as const;

// Who did what, when: every save, review, publish and setting, newest first. Append-only.
function AuditLog() {
  const t = useTranslations("Audit");
  const f = useFormatter();
  const url = useListState();
  const ti = useTranslations("Improvements");
  const kind = url.get("kind", "all"); const by = url.get("by", "all"); const page = url.page;
  const setKind = (kind: string) => url.set({ kind }); const setBy = (by: string) => url.set({ by }); const setPage = (page: number) => url.set({ page });
  const members = useMembersQuery();
  const type = kind === "all" ? undefined : kind;
  const { data, isLoading, error, refetch } = useAuditQuery({ search: url.get("search"), type, by: by === "all" ? undefined : by, page, pageSize: 10 });

  const columns = useMemo<ColumnDef<AuditEvent, any>[]>(
    () => [
      { id: "at", header: t("colWhen"), cell: ({ row }) => <span className="whitespace-nowrap text-fg-muted">{f.date(row.original.at, { dateStyle: "medium", timeStyle: "short" })}</span> },
      { id: "by", header: t("colWho"), cell: ({ row }) => <bdi dir="auto">{row.original.by.name ?? t(row.original.by.key === "scheduler" ? "scheduler" : "system")}</bdi> },
      { id: "action", header: t("colWhat"), cell: ({ row }) => <span className="text-fg">{t.has(`actions.${row.original.action}`) ? t(`actions.${row.original.action}`) : row.original.action}</span> },
      {
        id: "entry",
        header: t("colOn"),
        cell: ({ row }) => {
          const a = row.original;
          const ty = typeOfId(a.entry);
          return ty ? (
            <Link href={`/content/${ty.area}/${a.entry}`} dir="ltr" className="text-body-sm text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus">
              {a.targetName ?? a.entry}
              {a.locale ? ` · ${a.locale}` : ""}
            </Link>
          ) : (
            <span dir="ltr" className="text-body-sm text-fg-muted">{a.targetName ?? a.entry}</span>
          );
        },
      },
      { id: "version", header: t("colVersion"), meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums text-fg-subtle">{row.original.version ? `v${row.original.version}` : ""}</span> },
    ],
    [t, f],
  );
  const status = isLoading ? "loading" : error ? (statusOf(error) === 403 ? "forbidden" : "error") : "ready";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="wm-table-filters"><Input size="sm" className="wm-search" aria-label={ti("search")} placeholder={ti("search")} value={url.get("search")} onChange={e => url.set({ search: e.target.value })} />
        <Select size="sm" label={t("kind")} aria-label={t("kind")} value={kind} onValueChange={(v) => setKind(v ?? "all")} options={KINDS.map((k) => ({ value: k, label: k === "all" ? ti("all") : t(`kinds.${k}`) }))} className="w-52" />
        <Select
          size="sm"
          label={t("colWho")} aria-label={t("colWho")}
          value={by}
          onValueChange={(v) => setBy(v ?? "all")}
          options={[{ value: "all", label: ti("all") }, ...(members.data?.items ?? []).map((m) => ({ value: m.key, label: <bdi dir="auto">{m.name}</bdi> }))]}
          className="w-56"
        />
      </div>
      <DataTable
        label={t("title")}
        columns={columns.map(column => ({ ...column, enableSorting: false }))}
        data={data?.items ?? []}
        getRowId={(r) => `${r.at}-${r.entry}-${r.action}`}
        status={status}
        onRetry={refetch}
        empty={{ title: t("empty") }}
        mode="server"
        rowCount={data?.total ?? 0}
        pagination={{ pageIndex: page - 1, pageSize: 10 }}
        onPaginationChange={(u) => setPage((typeof u === "function" ? u({ pageIndex: page - 1, pageSize: 10 }) : u).pageIndex + 1)}
      />
    </div>
  );
}

export default function AuditPage() {
  return (
    <RequirePermission permission="settings:view">
      <AuditLog />
    </RequirePermission>
  );
}
