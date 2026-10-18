"use client";

import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Card, Skeleton, useFormatter } from "@orgtik/ui";
import { DataTable, type ColumnDef } from "@orgtik/ui/table";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = Record<string, string | number>;
export function OverviewChartFrame({
  title,
  description,
  loading,
  children,
  data,
  columns,
}: {
  title: string;
  description?: string;
  loading: boolean;
  children: ReactNode;
  data: Row[];
  columns: ColumnDef<Row>[];
}) {
  const t = useTranslations("Improvements");
  return (
    <Card className="flex min-w-0 flex-col gap-5">
      <header className="flex min-h-16 flex-col gap-1">
        <h3 className="font-display text-title-sm text-fg">{title}</h3>
        {description ? (
          <p className="text-body-sm text-fg-muted">{description}</p>
        ) : null}
      </header>
      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : !data.length ? (
        <p
          role="status"
          className="flex min-h-72 items-center justify-center text-body-sm text-fg-muted"
        >
          {t("noResults")}
        </p>
      ) : (
        children
      )}
      <details className="mt-auto border-t border-line pt-3">
        <summary className="cursor-pointer text-body-sm text-fg-muted">
          {t("viewData")}
        </summary>
        <DataTable
          label={title}
          data={data}
          columns={columns}
          getRowId={(row) => String(row.period ?? row.label)}
          empty={{ title: t("noResults") }}
        />
      </details>
    </Card>
  );
}

export function VisitsChart({
  title,
  description,
  loading,
  data,
  periodLabel,
  currentLabel,
  previousLabel,
  formatPeriod,
}: {
  title: string;
  description: string;
  loading: boolean;
  data: Row[];
  periodLabel: string;
  currentLabel: string;
  previousLabel: string;
  formatPeriod: (period: string | number) => string;
}) {
  const f = useFormatter();
  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "period",
      header: periodLabel,
      cell: ({ row }) => formatPeriod(row.original.period),
    },
    ...[
      ["visits", currentLabel],
      ["previous", previousLabel],
    ].map(([key, label]) => ({
      accessorKey: key,
      header: label,
      meta: { numeric: true },
      cell: ({ row }: { row: { original: Row } }) =>
        f.number(Number(row.original[key])),
    })),
  ];
  return (
    <OverviewChartFrame
      title={title}
      description={description}
      loading={loading}
      data={data}
      columns={columns}
    >
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm text-fg-muted">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden className="w-5 border-t-2 border-action-primary" />
          {currentLabel}
        </li>
        <li className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="w-5 border-t-2 border-dashed border-fg-subtle"
          />
          {previousLabel}
        </li>
      </ul>
      <div className="h-72 w-full min-w-0" dir="ltr" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--ot-line)"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="period"
              tick={{ fill: "var(--ot-fg-muted)", fontSize: 12 }}
              tickFormatter={formatPeriod}
              tickLine={false}
              axisLine={false}
              minTickGap={36}
            />
            <YAxis
              tick={{ fill: "var(--ot-fg-muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={52}
              allowDecimals={false}
              tickCount={5}
              tickFormatter={(value) => f.number(value)}
            />
            <Tooltip
              labelFormatter={(value) => formatPeriod(String(value))}
              formatter={(value) => f.number(Number(value))}
              contentStyle={{
                background: "var(--ot-bg-overlay)",
                border: "1px solid var(--ot-line)",
                borderRadius: 12,
                color: "var(--ot-fg)",
              }}
            />
            <Line
              dataKey="previous"
              name={previousLabel}
              stroke="var(--ot-fg-subtle)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="visits"
              name={currentLabel}
              stroke="var(--ot-action-primary-bg)"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </OverviewChartFrame>
  );
}

export function TopicsChart({
  title,
  valueLabel,
  categoryLabel,
  loading,
  data,
}: {
  title: string;
  valueLabel: string;
  categoryLabel: string;
  loading: boolean;
  data: { label: string; value: number }[];
}) {
  const f = useFormatter();
  const id = useId();
  const total = data.reduce((sum, row) => sum + row.value, 0);
  const circumference = 2 * Math.PI * 76;
  let offset = 0;
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "label", header: categoryLabel },
    {
      accessorKey: "value",
      header: valueLabel,
      meta: { numeric: true },
      cell: ({ row }) => f.number(Number(row.original.value)),
    },
  ];
  return (
    <OverviewChartFrame
      title={title}
      description={valueLabel}
      loading={loading}
      data={data}
      columns={columns}
    >
      <div className="grid min-h-72 items-center gap-6 sm:grid-cols-[minmax(10rem,40%)_1fr]">
        <div className="relative mx-auto w-full max-w-56">
          <svg
            viewBox="0 0 200 200"
            role="img"
            aria-labelledby={id}
            className="w-full"
          >
            <title id={id}>
              {title}: {f.number(total)} {valueLabel}
            </title>
            <circle
              cx="100"
              cy="100"
              r="76"
              fill="none"
              stroke="var(--ot-line)"
              strokeWidth="16"
            />
            {data.map((row, index) => {
              const length = total ? (row.value / total) * circumference : 0;
              const start = offset;
              offset += length;
              return (
                <circle
                  key={row.label}
                  cx="100"
                  cy="100"
                  r="76"
                  fill="none"
                  stroke="var(--ot-action-primary-bg)"
                  strokeOpacity={1 - (index / Math.max(1, data.length)) * 0.55}
                  strokeWidth="16"
                  strokeDasharray={`${Math.max(0, length - 3)} ${circumference}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 100 100)"
                />
              );
            })}
          </svg>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-10 text-center"
          >
            <span className="font-display text-title-lg tabular-nums text-fg">
              {f.number(total)}
            </span>
            <span className="text-caption text-fg-muted">{valueLabel}</span>
          </div>
        </div>
        <ul className="flex min-w-0 flex-col gap-4">
          {data.map((row, index) => (
            <li
              key={row.label}
              className="grid grid-cols-[.75rem_1fr_auto] items-start gap-3 text-body-sm"
            >
              <span
                aria-hidden
                className="mt-1 size-2.5 rounded-pill bg-action-primary"
                style={{
                  opacity: 1 - (index / Math.max(1, data.length)) * 0.55,
                }}
              />
              <span dir="auto" className="text-fg-muted">
                {row.label}
              </span>
              <span className="flex flex-col items-end gap-1 tabular-nums">
                <strong className="font-semibold text-fg">
                  {f.number(row.value)}
                </strong>
                <span className="text-caption text-fg-subtle">
                  {f.percent(total ? row.value / total : 0)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </OverviewChartFrame>
  );
}
