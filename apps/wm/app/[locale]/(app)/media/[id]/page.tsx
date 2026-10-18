"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowSquareOut, Copy, Trash } from "@phosphor-icons/react";
import {
  Badge,
  Button,
  buttonVariants,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  LocalizedField,
  NoPermissionState,
  NumberField,
  PageHeader,
  Select,
  Textarea,
  toast,
  useFormatter,
} from "@orgtik/ui";
import { DatePicker } from "@orgtik/ui/dates";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { Thumb } from "@/components/media/Thumb";
import { Link, useRouter } from "@/i18n/routing";
import { typeOfId } from "@/lib/contentTypes";
import { useEntryName } from "@/lib/entryName";
import { libraryUrl } from "@/lib/env";
import { safeReturn } from "@/lib/useListState";
import { useCan } from "@/lib/permissions";
import { statusOf, useDeleteMediaMutation, useMediaItemQuery, useUpdateMediaMutation, type ApiError, type Locale, type MediaItem, type MediaPatch, type RightsStatus } from "@/store/api";

const RIGHTS: RightsStatus[] = ["unknown", "owned", "licensed", "stock", "client"];
// How pages crop the picture: the focal point decides what stays in each frame.
const CROPS = [
  ["1 / 1", "square"],
  ["16 / 9", "wide"],
  ["4 / 5", "portrait"],
] as const;

function Editor({ m }: { m: MediaItem }) {
  const t = useTranslations("Media");
  const returnTo = safeReturn(useSearchParams().get("returnTo"), "/media");
  const ti = useTranslations("Improvements");
  const [description, setDescription] = useState(m.description ?? "");
  const [tags, setTags] = useState((m.tags ?? []).join(", "));
  const tp = useTranslations("EntryNames");
  const f = useFormatter();
  const uiLocale = useLocale();
  const can = useCan();
  const router = useRouter();
  const entryName = useEntryName();
  const editable = can("media:edit");
  const [alt, setAlt] = useState<Partial<Record<Locale, string>>>(m.alt);
  const [rights, setRights] = useState(m.rights);
  const [focal, setFocal] = useState(m.focal);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [save, saving] = useUpdateMediaMutation();
  const [remove] = useDeleteMediaMutation();
  // After a save the item comes back new: start again from what the server has.
  useEffect(() => {
    setAlt(m.alt);
    setRights(m.rights);
    setFocal(m.focal);
    setDescription(m.description ?? "");
    setTags((m.tags ?? []).join(", "));
  }, [m]);
  const patch: MediaPatch = {};
  if (description !== (m.description ?? "")) patch.description = description;
  if (tags !== (m.tags ?? []).join(", ")) patch.tags = tags.split(/[,،]/).map(tag => tag.trim()).filter(Boolean);
  if (JSON.stringify(alt) !== JSON.stringify(m.alt)) patch.alt = alt;
  if (JSON.stringify(rights) !== JSON.stringify(m.rights)) patch.rights = rights;
  if (focal.x !== m.focal.x || focal.y !== m.focal.y) patch.focal = focal;
  const dirty = Object.keys(patch).length > 0;
  const needsHolder = ["licensed", "stock", "client"].includes(rights.status);
  const inUse = m.usage > 0;

  const onSave = () => {
    setErrors({});
    save({ id: m.id, version: m.version, patch })
      .unwrap()
      .then(() => toast.success(t("saved")))
      .catch((e: ApiError) => {
        if (e.status === 422 && e.fieldErrors) setErrors(e.fieldErrors);
        else if (e.status === 412) toast.error(t("stale"));
        else toast.error(t("failed"));
      });
  };
  // Click (or tap) the picture to say what must stay in view when it's cropped.
  const pick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!editable) return;
    const r = e.currentTarget.getBoundingClientRect();
    // The picture isn't mirrored in RTL, so the point is measured from its physical left.
    setFocal({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) });
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <PageHeader
        breadcrumb={[{ label: t("title"), href: `/${uiLocale}${returnTo}` }, { label: <span dir="ltr">{m.file}</span> }]}
        title={<span dir="ltr">{m.file.split("/").pop()}</span>}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{t(`kindOne.${m.kind}`)}</span>
            <span>· {f.bytes(m.bytes)}</span>
            {m.width ? <span dir="ltr">· {m.width}×{m.height}</span> : null}
            <span>· {t(m.source === "upload" ? "fromUpload" : "fromWebsite")}</span>
          </span>
        }
        status={
          m.issues.length ? (
            <span className="flex flex-wrap gap-1">
              {m.issues.map((i) => (
                <Badge key={i} tone={i === "unused" ? "neutral" : "warning"}>{t(`issues.${i}`)}</Badge>
              ))}
            </span>
          ) : (
            <Badge tone="success">{t("ready")}</Badge>
          )
        }
        actions={
          <>
            <a href={libraryUrl(m)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost" })}>
              <ArrowSquareOut aria-hidden="true" className="size-4 rtl:-scale-x-100" />
              {t("open")}
            </a>
            <Button
              variant="ghost"
              startIcon={<Copy />}
              onClick={() =>
                navigator.clipboard
                  .writeText(new URL(libraryUrl(m), window.location.href).href)
                  .then(() => toast.success(t("copied")))
                  .catch(() => toast.error(t("copyFailed")))
              }
            >
              {t("copyAddress")}
            </Button>
            {can("media:delete") ? (
              <ConfirmDialog
                trigger={<Button variant="secondary" startIcon={<Trash />}>{t("delete")}</Button>}
                tone="danger"
                irreversible
                title={t("deleteTitle", { file: m.file })}
                impact={inUse ? t("deleteBlocked", { count: m.usage }) : t("deleteImpact")}
                confirmLabel={t("delete")}
                onConfirm={() =>
                  remove(m.id)
                    .unwrap()
                    .then(() => {
                      toast.success(t("deleted"));
                      router.push(returnTo);
                    })
                    .catch((e: ApiError) => {
                      toast.error(e.code === "in_use" ? t("deleteBlocked", { count: m.usage }) : t("failed"));
                      throw e;
                    })
                }
              />
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="focal" className="flex flex-col gap-3 rounded-card border border-line bg-raised p-4">
          <h2 id="focal" className="text-label text-fg">{t("focal")}</h2>
          <p className="text-body-sm text-fg-muted">{m.kind === "video" ? t("focalVideo") : t("focalHelp")}</p>
          <button
            type="button"
            dir="ltr"
            onClick={pick}
            disabled={!editable}
            aria-label={t("focalPick")}
            className="relative block w-full overflow-hidden rounded-field bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-default"
            style={{ aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : "4 / 3" }}
          >
            <Thumb m={{ ...m, focal: { x: 50, y: 50 } }} className="absolute inset-0 size-full" />
            <span aria-hidden="true" className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-white shadow-overlay ring-2 ring-action-primary" style={{ left: `${focal.x}%`, top: `${focal.y}%` }} />
          </button>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("focalX")} error={errors.focal ? t("errorFocal") : undefined}>
              <NumberField min={0} max={100} value={focal.x} disabled={!editable} onValueChange={(v) => setFocal((p) => ({ ...p, x: v ?? 50 }))} format={{ style: "unit", unit: "percent" }} />
            </Field>
            <Field label={t("focalY")}>
              <NumberField min={0} max={100} value={focal.y} disabled={!editable} onValueChange={(v) => setFocal((p) => ({ ...p, y: v ?? 50 }))} format={{ style: "unit", unit: "percent" }} />
            </Field>
          </div>
          {m.kind !== "video" ? (
            <div className="grid grid-cols-3 gap-3">
              {CROPS.map(([ratio, key]) => (
                <figure key={key} className="flex flex-col gap-1">
                  <span className="relative block overflow-hidden rounded-field bg-sunken" style={{ aspectRatio: ratio }}>
                    <Thumb m={{ ...m, focal }} className="absolute inset-0 size-full" />
                  </span>
                  <figcaption className="text-caption text-fg-subtle">{t(`crops.${key}`)}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </section>

        <div className="flex flex-col gap-6">
          <Field label={ti("description")}><Textarea disabled={!editable} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></Field>
          <Field label={ti("tags")}><Input disabled={!editable} value={tags} onChange={event => setTags(event.target.value)} /></Field>
          {m.kind !== "video" ? (
            <LocalizedField label={t("altText")} description={t("altHelp")} value={alt} onChange={(v) => setAlt(v)} required={["en"]} multiline errors={undefined} />
          ) : null}

          <section aria-labelledby="rights" className="flex flex-col gap-4 rounded-card border border-line bg-raised p-4">
            <h2 id="rights" className="text-label text-fg">{t("rights")}</h2>
            <Field label={t("rightsStatus")} error={errors["rights.status"] ? t("errorRequired") : undefined}>
              <Select readOnly={!editable} value={rights.status} onValueChange={(v) => v && setRights((r) => ({ ...r, status: v as RightsStatus }))} options={RIGHTS.map((x) => ({ value: x, label: t(`rightsStates.${x}`) }))} />
            </Field>
            {needsHolder ? (
              <Field label={t("rightsHolder")} error={errors["rights.holder"] ? t("errorHolder") : undefined}>
                <Input dir="auto" readOnly={!editable} value={rights.holder} onChange={(e) => setRights((r) => ({ ...r, holder: e.target.value }))} />
              </Field>
            ) : null}
            {rights.status !== "unknown" && rights.status !== "owned" ? (
              <Field label={t("rightsExpires")} description={t("rightsExpiresHelp")}>
                <DatePicker aria-label={t("rightsExpires")} disabled={!editable} value={rights.expires} onChange={(v) => setRights((r) => ({ ...r, expires: v }))} />
              </Field>
            ) : null}
            <Field label={t("rightsNote")}>
              <Textarea dir="auto" rows={2} readOnly={!editable} value={rights.note} onChange={(e) => setRights((r) => ({ ...r, note: e.target.value }))} />
            </Field>
          </section>

          <section aria-labelledby="uses" className="flex flex-col gap-3 rounded-card border border-line bg-raised p-4">
            <h2 id="uses" className="text-label text-fg">{t("uses", { count: m.usage })}</h2>
            {m.usage === 0 ? <p className="text-body-sm text-fg-muted">{t("notUsed")}</p> : null}
            <ul className="flex flex-col gap-2">
              {(m.uses ?? []).map((u) => {
                const type = typeOfId(u.entry);
                return (
                  <li key={u.entry + u.field} className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
                    {type ? (
                      <Link href={`/content/${type.area}/${u.entry}`} dir="auto" className="font-semibold text-fg hover:underline focus-visible:outline-2 focus-visible:outline-focus">
                        {entryName({ id: u.entry, name: u.name })}
                      </Link>
                    ) : (
                      <span dir="auto">{u.name}</span>
                    )}
                    <span className="text-caption text-fg-subtle">
                      <span dir="ltr">{u.field}</span>
                      {u.ownAlt ? ` · ${t("ownAlt")}` : ""}
                    </span>
                  </li>
                );
              })}
              {m.templateUses.map((p) => (
                <li key={p} className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
                  <span className="text-fg">{tp.has(`pg_${p}`) ? tp(`pg_${p}`) : t(`code.${p}`)}</span>
                  <span className="text-caption text-fg-subtle">{t("inPageCode")}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {dirty && editable ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised/95 px-4 py-3 shadow-overlay backdrop-blur lg:ps-[340px]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span className="text-body-sm font-semibold text-fg">{t("unsaved")}</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => (setAlt(m.alt), setRights(m.rights), setFocal(m.focal), setErrors({}))}>
                {t("discard")}
              </Button>
              <Button loading={saving.isLoading} onClick={onSave}>
                {t("save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MediaItemPage() {
  const t = useTranslations("Media");
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useMediaItemQuery(id);
  const s = statusOf(error);
  if (isLoading) return <LoadingState rows={6} />;
  if (s === 404) return <EmptyState title={t("notFound")} action={<Button onClick={() => history.back()}>{t("back")}</Button>} />;
  if (s === 403) return <NoPermissionState />;
  if (error || !data) return <ErrorState onRetry={refetch} />;
  return <Editor key={data.id} m={data} />;
}

export default function MediaDetailPage() {
  return (
    <RequirePermission permission="media:view">
      <MediaItemPage />
    </RequirePermission>
  );
}
