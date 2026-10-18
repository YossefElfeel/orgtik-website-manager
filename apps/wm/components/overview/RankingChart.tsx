"use client";
import { useTranslations } from "next-intl";
import { Card, Skeleton, useFormatter } from "@orgtik/ui";
import { DataTable, type ColumnDef } from "@orgtik/ui/table";

type Row = { label: string; value: number };
export function RankingChart({
  title,
  description,
  rows,
  valueLabel,
  label,
  loading,
}: {
  title: string;
  description?: string;
  rows: Row[];
  valueLabel: string;
  label: string;
  loading: boolean;
}) {
  const t = useTranslations("Improvements");
  const f = useFormatter();
  const max = Math.max(1, ...rows.map((row) => row.value));
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "label", header: label },
    {
      accessorKey: "value",
      header: valueLabel,
      meta: { numeric: true },
      cell: ({ row }) => f.number(row.original.value),
    },
  ];
  return (
    <Card className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h3 className="font-display text-title-sm text-fg">{title}</h3>
        <p className="text-body-sm text-fg-muted">
          {description || valueLabel}
        </p>
      </header>
      <div
        aria-label={title}
        role="img"
        className="grid grid-cols-[fit-content(40%)_minmax(0,1fr)] gap-3"
      >
        {loading ? (
          <Skeleton className="col-span-2 h-64 w-full" />
        ) : !rows.length ? (
          <p
            role="status"
            className="col-span-2 py-8 text-center text-body-sm text-fg-muted"
          >
            {t("noResults")}
          </p>
        ) : (
          rows.map((row, index) => (
            <div
              key={row.label}
              className="col-span-2 grid min-h-6 grid-cols-subgrid items-center text-body-sm"
            >
              <span className="min-w-0 break-words text-start text-fg-muted">
                <bdi>{row.label}</bdi>
              </span>
              <div className="pe-12">
                <div
                  className="relative h-6"
                  style={{ width: `${(row.value / max) * 100}%` }}
                >
                  <span
                    className="absolute inset-0 bg-action-primary"
                    style={{
                      opacity: 1 - (index / Math.max(1, rows.length)) * 0.55,
                    }}
                  />
                  <span className="absolute start-full ps-2 font-semibold tabular-nums text-fg">
                    {f.number(row.value)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <details className="mt-auto border-t border-line pt-3">
        <summary className="cursor-pointer text-body-sm text-fg-muted">
          {t("viewData")}
        </summary>
        <DataTable
          empty={{ title: t("noResults") }}
          label={title}
          data={rows}
          columns={columns}
          getRowId={(row) => row.label}
        />
      </details>
    </Card>
  );
}
