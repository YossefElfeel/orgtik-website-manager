"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarBlank } from "@phosphor-icons/react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  StatusBadge,
  toast,
  useFormatter,
} from "@orgtik/ui";
import { DatePicker } from "@orgtik/ui/dates";
import { useCan } from "@/lib/permissions";
import { useEntryVersionQuery, useRestoreEntryMutation, useTranslateEntryMutation, type ApiError, type Entry, type Locale } from "@/store/api";

type Tree = Record<string, unknown>;

/** Every leaf of a tree by its path ("locales.en.goal"): what a version comparison looks at. */
function leaves(v: unknown, at = "", out: Record<string, string> = {}) {
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Tree)) leaves(x, at ? `${at}.${k}` : k, out);
  else out[at] = v == null ? "" : String(v);
  return out;
}
const clip = (s: string) => (s.length > 90 ? `${s.slice(0, 90)}…` : s);

/** What changed from the version before, field by field. */
function VersionChanges({ entry, version, before }: { entry: Entry; version: number; before: number | null }) {
  const t = useTranslations("Editor");
  const ref = { type: entry.type, id: entry.id };
  const now = useEntryVersionQuery({ ...ref, version });
  const prev = useEntryVersionQuery({ ...ref, version: before ?? 0 }, { skip: before === null });
  if (now.isLoading || prev.isLoading) return <p className="text-caption text-fg-subtle">{t("loadingChanges")}</p>;
  if (!now.data?.content) return <p className="text-caption text-fg-subtle">{t("noSnapshot")}</p>;
  if (before === null) return <p className="text-caption text-fg-subtle">{t("firstVersion")}</p>;
  const a = leaves(prev.data?.content);
  const b = leaves(now.data.content);
  const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
  if (!changed.length) return <p className="text-caption text-fg-subtle">{t("noChanges")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {changed.slice(0, 12).map((k) => (
        <li key={k} className="flex flex-col gap-0.5 text-caption">
          <span dir="ltr" className="text-start font-mono text-fg-subtle">{k}</span>
          {a[k] ? <del dir="auto" className="text-danger">{clip(a[k])}</del> : null}
          {b[k] ? <ins dir="auto" className="text-success no-underline">{clip(b[k])}</ins> : null}
        </li>
      ))}
      {changed.length > 12 ? <li className="text-caption text-fg-subtle">{t("moreChanges", { count: changed.length - 12 })}</li> : null}
    </ul>
  );
}

/** One row of the version history: who, when, what changed, and restoring it. */
export function VersionRow({ entry, index, onError, readOnly = false }: { entry: Entry; index: number; onError: (e: unknown) => void; readOnly?: boolean }) {
  const t = useTranslations("Editor");
  const f = useFormatter();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [restore] = useRestoreEntryMutation();
  const v = entry.versions[index];
  const before = entry.versions[index + 1]?.version ?? null;
  const current = index === 0;
  const previousContent = useEntryVersionQuery({ type: entry.type, id: entry.id, version: v.version }, { skip: current || entry.type !== "caseStudy" || can("content:approve") });
  const needsApproval = entry.type === "caseStudy" && !can("content:approve") && (!previousContent.data?.content || (["narrativePublished", "sampleNarrativePublished"] as const).some(key => previousContent.data?.content?.[key] !== entry.content[key]));
  return (
    <li className="flex flex-col gap-1 border-b border-line pb-3 last:border-0">
      <span className="flex items-center gap-2">
        <StatusBadge entity="cms_revision" state={v.state} size="sm" />
        <span className="text-caption text-fg-muted tabular-nums">v{v.version}</span>
      </span>
      <span className="text-body-sm text-fg">
        {f.date(v.at, { dateStyle: "medium", timeStyle: "short" })} · <bdi dir="auto">{v.by.name ?? t("imported")}</bdi>
      </span>
      {v.note ? <span dir="auto" className="text-body-sm text-fg-muted">{v.note}</span> : null}
      <span className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? t("hideChanges") : t("showChanges")}
        </Button>
        {!current && !readOnly && can("content:edit") && !needsApproval ? (
          <ConfirmDialog
            trigger={<Button size="sm" variant="secondary">{t("restore")}</Button>}
            tone="primary"
            title={t("restoreTitle", { version: v.version })}
            impact={t("restoreImpact")}
            confirmLabel={t("restore")}
            onConfirm={() =>
              restore({ type: entry.type, id: entry.id, version: entry.version, restore: v.version })
                .unwrap()
                .then(() => toast.success(t("restored", { version: v.version })))
                .catch((e) => {
                  onError(e);
                  throw e;
                })
            }
          />
        ) : null}
        {!current && needsApproval ? <span className="text-body-sm text-fg-muted">{t("narrativePermission")}</span> : null}
      </span>
      {open ? <VersionChanges entry={entry} version={v.version} before={before} /> : null}
    </li>
  );
}

/** Where a translation stands, and moving it through review (status matrix: translation). */
export function TranslationBar({ entry, lang, dirty, onError }: { entry: Entry; lang: Locale; dirty: boolean; onError: (e: unknown) => void }) {
  const t = useTranslations("Editor");
  const can = useCan();
  const [translate, busy] = useTranslateEntryMutation();
  const state = entry.translation[lang];
  const go = (action: "submit" | "approve" | "reopen") =>
    translate({ type: entry.type, id: entry.id, version: entry.version, locale: lang, action })
      .unwrap()
      .then(() => toast.success(t(`translationDone.${action}`)))
      .catch(onError);
  const actions: { action: "submit" | "approve" | "reopen"; show: boolean; primary?: boolean }[] = [
    { action: "submit", show: ["in_progress", "outdated"].includes(state) && can("localization:edit"), primary: true },
    { action: "approve", show: state === "needs_review" && can("localization:approve"), primary: true },
    { action: "reopen", show: ["needs_review", "ready"].includes(state) && can("localization:edit") },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-field border border-line bg-raised px-3 py-2">
      <span className="text-body-sm text-fg-muted">{t("translationState")}</span>
      <StatusBadge entity="translation" state={state} size="sm" />
      <span className="ms-auto flex flex-wrap gap-2">
        {actions
          .filter((a) => a.show)
          .map((a) => (
            <Button key={a.action} size="sm" variant={a.primary ? "secondary" : "ghost"} disabled={dirty} title={dirty ? t("saveFirst") : undefined} loading={busy.isLoading} onClick={() => go(a.action)}>
              {t(`translationActions.${a.action}`)}
            </Button>
          ))}
      </span>
    </div>
  );
}

/** Publishing at a chosen time instead of now; the mock's clock publishes it then. */
export function ScheduleButton({ onSchedule, onError }: { onSchedule: (publishAt: string) => Promise<unknown>; onError: (error: unknown) => void }) {
  const t = useTranslations("Editor");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const submit = () => {
    if (!date) return;
    // The date and time the person picked, in their time zone.
    const at = new Date(`${date}T${time || "09:00"}:00`);
    setBusy(true);
    setError(false);
    onSchedule(at.toISOString())
      .then(() => setOpen(false))
      .catch((e: ApiError) => {
        if (e?.fieldErrors?.publishAt === "future") setError(true);
        else {
          setOpen(false);
          onError(e);
        }
      })
      .finally(() => setBusy(false));
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" startIcon={<CalendarBlank />} onClick={() => setOpen(true)}>
        {t("schedule")}
      </Button>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("scheduleTitle")}</DialogTitle>
          <DialogDescription>{t("scheduleBody")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t("scheduleDate")} error={error ? t("errorFuture") : undefined}>
            <DatePicker aria-label={t("scheduleDate")} value={date} onChange={setDate} />
          </Field>
          <Field label={t("scheduleTime")}>
            <Input dir="ltr" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button disabled={!date} loading={busy} onClick={submit}>
            {t("schedule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
