"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, ErrorState, Field, Input, LoadingState, NoPermissionState, PageHeader, Progress, Select, Switch, Textarea, toast } from "@orgtik/ui";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { useCan } from "@/lib/permissions";
import { statusOf, useMediaQuery, useSiteQuery, useUpdateSiteMutation, type ApiError, type Locale, type SiteSettings } from "@/store/api";

const NATIVE: Record<Locale, string> = { en: "English", ar: "العربية", de: "Deutsch", fr: "Français", it: "Italiano" };
type Form = Pick<SiteSettings, "siteName" | "titleTemplate" | "defaultDescription" | "defaultOgImage" | "organization" | "formsMode" | "locales">;
const formOf = (s: SiteSettings): Form => ({ siteName: s.siteName, titleTemplate: s.titleTemplate, defaultDescription: s.defaultDescription, defaultOgImage: s.defaultOgImage, organization: s.organization, formsMode: s.formsMode, locales: s.locales });

function SiteForm({ site }: { site: SiteSettings }) {
  const t = useTranslations("Site");
  const ti = useTranslations("Improvements");
  const can = useCan();
  const editable = can("settings:edit");
  const canLocales = editable && can("locales:enable");
  const images = useMediaQuery({ kind: "image", pageSize: 100 });
  const [form, setForm] = useState<Form>(formOf(site));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [save, saving] = useUpdateSiteMutation();
  useEffect(() => setForm(formOf(site)), [site]);
  const dirty = JSON.stringify(form) !== JSON.stringify(formOf(site));
  const org = (k: keyof Form["organization"], v: string) => setForm((f) => ({ ...f, organization: { ...f.organization, [k]: v } }));
  const setLocale = (code: Locale, patch: Partial<Form["locales"][number]>) => setForm((f) => ({ ...f, locales: f.locales.map((l) => (l.code === code ? { ...l, ...patch } : l)) }));
  const onSave = () => {
    setErrors({});
    const localesChanged = JSON.stringify(form.locales) !== JSON.stringify(site.locales);
    const { locales, ...rest } = form;
    save({ version: site.version, patch: { ...rest, ...(localesChanged ? { locales } : {}) } })
      .unwrap()
      .then(() => toast.success(t("saved")))
      .catch((e: ApiError) => {
        if (e.status === 422 && e.fieldErrors) setErrors(e.fieldErrors);
        else if (e.status === 412) toast.error(t("stale"));
        else if (e.status === 403) toast.error(t("needsLocales"));
        else toast.error(t("failed"));
      });
  };
  const preview = form.titleTemplate.replace("{page}", t("examplePage"));

  return (
    <div className="flex flex-col gap-6 pb-24">
      <PageHeader title={t("title")} description={t("description")} />
      <Card className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-label text-fg sm:col-span-2">{t("identity")}</h2><p className="text-body-sm text-fg-muted sm:col-span-2">{ti("identityHelp")}</p>
        <Field label={t("siteName")} error={errors.siteName ? t("errorRequired") : undefined}>
          <Input dir="auto" disabled={!editable} value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
        </Field>
      </Card>
      <Card className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-label text-fg sm:col-span-2">{ti("searchSocial")}</h2><p className="text-body-sm text-fg-muted sm:col-span-2">{ti("searchSocialHelp")}</p>
        <Field label={t("titleTemplate")} description={t("titleTemplateHelp", { preview, page: "{page}" })} error={errors.titleTemplate ? t("errorTemplate", { page: "{page}" }) : undefined}>
          <Input dir="auto" disabled={!editable} value={form.titleTemplate} onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })} />
        </Field>
        <Field
          className="sm:col-span-2"
          label={t("defaultDescription")}
          description={t("defaultDescriptionHelp", { count: form.defaultDescription.length })}
          error={errors.defaultDescription ? t(errors.defaultDescription === "too_long" ? "errorTooLong" : "errorRequired") : undefined}
        >
          <Textarea dir="auto" rows={2} disabled={!editable} value={form.defaultDescription} onChange={(e) => setForm({ ...form, defaultDescription: e.target.value })} />
        </Field>
        <Field label={t("defaultImage")} description={t("defaultImageHelp")}>
          <Select
            disabled={!editable}
            value={form.defaultOgImage ?? "none"}
            onValueChange={(v) => setForm({ ...form, defaultOgImage: v === "none" ? null : v })}
            options={[{ value: "none", label: t("noImage") }, ...(images.data?.items ?? []).map((m) => ({ value: m.id, label: <span dir="ltr">{m.file}</span> }))]}
          />
        </Field>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-label text-fg sm:col-span-2">{t("organization")}</h2>
        <p className="text-body-sm text-fg-muted sm:col-span-2">{t("organizationHelp")}</p>
        <Field label={t("orgName")}>
          <Input dir="auto" disabled={!editable} value={form.organization.name} onChange={(e) => org("name", e.target.value)} />
        </Field>
        <Field label={t("orgEmail")} error={errors["organization.email"] ? t("errorEmail") : undefined}>
          <Input dir="ltr" type="email" disabled={!editable} value={form.organization.email} onChange={(e) => org("email", e.target.value)} />
        </Field>
        <Field label={t("orgPhone")}>
          <Input dir="ltr" type="tel" disabled={!editable} value={form.organization.phone} onChange={(e) => org("phone", e.target.value)} />
        </Field>
        <Field label={t("orgAddress")}>
          <Input dir="auto" disabled={!editable} value={form.organization.address} onChange={(e) => org("address", e.target.value)} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-label text-fg">{t("forms")}</h2><p className="text-body-sm text-fg-muted">{ti("formsHelp")}</p>
        <Field label={t("formsMode")} description={t("formsModeHelp")} error={errors.formsMode === "privacy_first" ? t("errorPrivacyFirst") : undefined}>
          <Select disabled={!editable} value={form.formsMode} onValueChange={(v) => v && setForm({ ...form, formsMode: v as Form["formsMode"] })} options={(["preview", "live"] as const).map((m) => ({ value: m, label: t(`formsModes.${m}`) }))} className="max-w-sm" />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-label text-fg">{t("languages")}</h2>
          <p className="text-body-sm text-fg-muted">{canLocales ? t("languagesHelp") : t("needsLocales")}</p>
          {errors.locales ? <p className="text-body-sm text-danger">{t(`errorLocales.${errors.locales}`)}</p> : null}
        </div>
        <ul className="flex flex-col divide-y divide-line">
          {form.locales.map((l) => {
            const r = site.readiness[l.code];
            return (
              <li key={l.code} className="grid items-center gap-3 py-3 sm:grid-cols-[10rem_1fr_auto_auto]">
                <span className="text-start font-semibold text-fg"><bdi lang={l.code} dir={l.code === "ar" ? "rtl" : "ltr"}>{NATIVE[l.code] ?? new Intl.DisplayNames([l.code],{type:"language"}).of(l.code)}</bdi></span>
                <Progress value={r ? Math.round((r.done / Math.max(1, r.total)) * 100) : 0} label={<span className="text-caption text-fg-muted">{t("readiness", { done: r?.done ?? 0, total: r?.total ?? 0 })}</span>} />
                <label className="inline-flex items-center gap-2 text-body-sm text-fg">
                  <Switch checked={l.enabled} disabled={!canLocales || l.code === "en"} onCheckedChange={(v) => setLocale(l.code, { enabled: v, ...(v ? {} : { public: false }) })} aria-label={t("enabledFor", { language: NATIVE[l.code] })} />
                  {t("enabled")}
                </label>
                <label className="inline-flex items-center gap-2 text-body-sm text-fg">
                  <Switch checked={l.public} disabled={!canLocales || l.code === "en" || !l.enabled} onCheckedChange={(v) => setLocale(l.code, { public: v })} aria-label={t("publicFor", { language: NATIVE[l.code] })} />
                  {t("public")}
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-body-sm text-fg-subtle">{t("arabicNote")}</p>
      </Card>

      {dirty && editable ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised/95 px-4 py-3 shadow-overlay backdrop-blur lg:ps-[340px]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span className="text-body-sm font-semibold text-fg">{t("unsaved")}</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => (setForm(formOf(site)), setErrors({}))}>
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

function SitePage() {
  const { data, isLoading, error, refetch } = useSiteQuery();
  const s = statusOf(error);
  if (isLoading) return <LoadingState rows={6} />;
  if (s === 403) return <NoPermissionState />;
  if (error || !data) return <ErrorState onRetry={refetch} />;
  return <SiteForm site={data} />;
}

export default function SiteSettingsPage() {
  return (
    <RequirePermission permission="settings:view">
      <SitePage />
    </RequirePermission>
  );
}
