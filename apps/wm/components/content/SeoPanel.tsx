"use client";

// An entry's SEO block, in one language (plan: "Metadata and slugs on everything"): how it shows in
// search results and link previews, its keywords and the checks they drive, indexing, and
// structured data. Lengths are measured the way results are cut: by width in pixels, not letters.
import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle, Circle, Code, Globe, Info, MagnifyingGlass, ShareNetwork } from "@phosphor-icons/react";
import { Badge, Card, Checkbox, Field, Input, Select, Tag, Textarea } from "@orgtik/ui";
import { mediaUrl } from "@/lib/env";
import type { Locale } from "@/store/api";

export type SeoBlock = {
  title?: string;
  description?: string;
  focus?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  robots?: "index" | "noindex";
  inSitemap?: boolean;
  canonical?: string;
  jsonLd?: unknown;
};

// Search results cut titles at about 600px (20px Arial) and descriptions at about two lines.
const TITLE_PX = 600;
const DESCRIPTION_PX = 920;
let canvas: HTMLCanvasElement | null = null;
function widthOf(text: string, font: string) {
  if (typeof document === "undefined") return text.length * 8;
  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  return Math.round(ctx.measureText(text).width);
}
function cut(text: string, font: string, max: number) {
  if (widthOf(text, font) <= max) return text;
  let s = text;
  while (s && widthOf(`${s}…`, font) > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}
const has = (text: string, phrase: string) => Boolean(phrase.trim()) && text.toLowerCase().includes(phrase.trim().toLowerCase());

function Section({ icon, title, children, aside }: { icon: ReactNode; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-title-sm text-fg">
          <span aria-hidden="true" className="text-fg-subtle [&>svg]:size-5">
            {icon}
          </span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export function SeoPanel({
  lang,
  seo,
  english,
  address,
  slug,
  siteHidden,
  entryImage,
  images,
  structuredType,
  errors,
  can,
  onChange,
}: {
  lang: Locale;
  seo: SeoBlock;
  /** The English block: what an untranslated field falls back to. */
  english: SeoBlock;
  /** The page's full address, for the previews ("orgtik.ch/work/…"). */
  address: string;
  slug: string;
  /** The whole site is hidden from search (Indexing): a page's own setting waits for it. */
  siteHidden: boolean;
  entryImage?: string;
  images: { value: string; label: string }[];
  /** What the site generates for this page ("Service", "BlogPosting"…), or null. */
  structuredType: string | null;
  errors: Record<string, string>;
  can: { edit: boolean; canonical: boolean; jsonLd: boolean };
  onChange: (patch: Partial<SeoBlock>) => void;
}) {
  const t = useTranslations("Seo.block");
  const title = seo.title ?? "";
  const description = seo.description ?? "";
  const shownTitle = title || english.title || "";
  const shownDescription = description || english.description || "";
  const titlePx = widthOf(shownTitle, "20px Arial");
  const descriptionPx = widthOf(shownDescription, "14px Arial");
  const keywords = seo.keywords ?? [];
  const [keyword, setKeyword] = useState("");
  const [json, setJson] = useState(() => (seo.jsonLd ? JSON.stringify(seo.jsonLd, null, 2) : ""));
  const [jsonError, setJsonError] = useState(false);
  const focus = seo.focus ?? "";
  const ogTitle = seo.ogTitle || shownTitle;
  const ogDescription = seo.ogDescription || shownDescription;
  const ogImage = seo.ogImage || english.ogImage || entryImage;
  const err = (k: string) => errors[`seo.${k}`];
  const tooLong = (k: string) => (err(k) === "too_long" ? t("tooLong") : undefined);

  // The checklist the old dashboard's keyword fields fed, per language (plan: "a checklist, not a vanity score").
  const checks = useMemo(
    () => [
      { key: "titleSet", ok: Boolean(title.trim()) },
      { key: "titleFits", ok: Boolean(shownTitle) && titlePx <= TITLE_PX },
      { key: "descriptionSet", ok: description.trim().length >= 50 },
      { key: "descriptionFits", ok: Boolean(shownDescription) && descriptionPx <= DESCRIPTION_PX },
      { key: "focusInTitle", ok: has(shownTitle, focus), needs: "focus" },
      { key: "focusInDescription", ok: has(shownDescription, focus), needs: "focus" },
      { key: "focusInAddress", ok: has(slug.replace(/-/g, " "), focus.replace(/-/g, " ")), needs: "focus" },
      { key: "socialImage", ok: Boolean(ogImage) },
    ],
    [title, shownTitle, titlePx, description, shownDescription, descriptionPx, focus, slug, ogImage],
  );
  const done = checks.filter((c) => c.ok).length;

  const addKeyword = () => {
    const k = keyword.trim();
    if (!k || keywords.some((x) => x.toLowerCase() === k.toLowerCase())) return setKeyword("");
    onChange({ keywords: [...keywords, k] });
    setKeyword("");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Section icon={<MagnifyingGlass />} title={t("search")}>
          {/* The result as a search engine shows it: address, title and description, cut where they'd be cut.
              Its colours are the search engine's own, on purpose and in both themes: it shows what people see there. */}
          <div aria-label={t("searchPreview")} role="img" className="rounded-field border border-line bg-white p-4 text-start" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
            <div dir="ltr" className="truncate text-start text-[12px] text-[#4D5156]">
              {address}
            </div>
            <div className="mt-1 truncate text-[20px] leading-7 text-[#1A0DAB]" style={{ fontFamily: "Arial, sans-serif" }}>
              {shownTitle ? cut(shownTitle, "20px Arial", TITLE_PX) : <span className="text-[#70757A]">{t("noTitle")}</span>}
            </div>
            <p className="mt-1 line-clamp-2 text-[14px] leading-[22px] text-[#4D5156]" style={{ fontFamily: "Arial, sans-serif" }}>
              {shownDescription ? cut(shownDescription, "14px Arial", DESCRIPTION_PX) : <span className="text-[#70757A]">{t("noDescription")}</span>}
            </p>
          </div>
          <Field label={t("title")} description={t("pixels", { used: titlePx, max: TITLE_PX })} error={tooLong("title")}>
            <Input dir="auto" lang={lang} readOnly={!can.edit} value={title} placeholder={lang === "en" ? undefined : english.title} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <Field label={t("description")} description={t("descriptionHelp", { count: description.length, used: descriptionPx, max: DESCRIPTION_PX })} error={tooLong("description")}>
            <Textarea dir="auto" lang={lang} rows={3} readOnly={!can.edit} value={description} placeholder={lang === "en" ? undefined : english.description} onChange={(e) => onChange({ description: e.target.value })} />
          </Field>
        </Section>

        <Section icon={<Info />} title={t("keywords")}>
          <Field label={t("focus")} description={t("focusHelp")} error={tooLong("focus")}>
            <Input dir="auto" lang={lang} readOnly={!can.edit} value={focus} onChange={(e) => onChange({ focus: e.target.value })} />
          </Field>
          <Field label={t("keywordList")} description={t("keywordListHelp")} error={err("keywords") ? t("keywordsInvalid") : undefined}>
            <div className="flex flex-col gap-2">
              {keywords.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {keywords.map((k) => (
                    <li key={k}>
                      <Tag onRemove={can.edit ? () => onChange({ keywords: keywords.filter((x) => x !== k) }) : undefined}>
                        <bdi>{k}</bdi>
                      </Tag>
                    </li>
                  ))}
                </ul>
              ) : null}
              {can.edit ? (
                <Input
                  dir="auto"
                  lang={lang}
                  value={keyword}
                  placeholder={t("keywordPlaceholder")}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  onBlur={addKeyword}
                />
              ) : null}
            </div>
          </Field>
        </Section>

        <Section icon={<ShareNetwork />} title={t("social")}>
          <Field label={t("ogTitle")} description={t("ogFallback")} error={tooLong("ogTitle")}>
            <Input dir="auto" lang={lang} readOnly={!can.edit} value={seo.ogTitle ?? ""} placeholder={shownTitle} onChange={(e) => onChange({ ogTitle: e.target.value })} />
          </Field>
          <Field label={t("ogDescription")} description={t("ogFallback")} error={tooLong("ogDescription")}>
            <Textarea dir="auto" lang={lang} rows={2} readOnly={!can.edit} value={seo.ogDescription ?? ""} placeholder={shownDescription} onChange={(e) => onChange({ ogDescription: e.target.value })} />
          </Field>
          <Field label={t("ogImage")} description={t("ogImageHelp")}>
            <Select readOnly={!can.edit} value={seo.ogImage || "default"} onValueChange={(v) => onChange({ ogImage: !v || v === "default" ? "" : v })} options={[{ value: "default", label: t("ogImageDefault") }, ...images.map((i) => ({ value: i.value, label: <span dir="ltr">{i.label}</span> }))]} />
          </Field>
        </Section>

        <Section icon={<Globe />} title={t("indexing")}>
          {siteHidden ? (
            <p className="rounded-field bg-warning-subtle px-3 py-2 text-body-sm text-warning">{t("siteHidden")}</p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("robots")}>
              <Select
                readOnly={!can.edit}
                value={seo.robots ?? "index"}
                onValueChange={(v) => onChange({ robots: v as "index" | "noindex" })}
                options={[
                  { value: "index", label: t("robotsIndex") },
                  { value: "noindex", label: t("robotsNoindex") },
                ]}
              />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox disabled={!can.edit} checked={seo.inSitemap !== false} onCheckedChange={(v: boolean) => onChange({ inSitemap: v })} label={t("inSitemap")} />
            </div>
          </div>
          <Field label={t("canonical")} description={can.canonical ? t("canonicalHelp", { address }) : t("canonicalSeoOnly")} error={err("canonical") ? t("canonicalInvalid") : undefined}>
            <Input dir="ltr" readOnly={!can.canonical} value={seo.canonical ?? ""} placeholder={address.startsWith("http") ? address : `https://${address}`} onChange={(e) => onChange({ canonical: e.target.value.trim() })} />
          </Field>
        </Section>

        <Section icon={<Code />} title={t("structured")} aside={structuredType ? <Badge tone="info">{structuredType}</Badge> : null}>
          <p className="text-body-sm text-fg-muted">{structuredType ? t("structuredGenerated", { type: structuredType }) : t("structuredNone")}</p>
          <Field
            label={t("customJsonLd")}
            description={can.jsonLd ? t("customJsonLdHelp") : t("customJsonLdLocked")}
            error={jsonError ? t("jsonInvalid") : err("jsonLd") ? t("jsonType") : undefined}
          >
            <Textarea
              dir="ltr"
              rows={6}
              className="font-mono text-body-sm"
              readOnly={!can.jsonLd}
              value={json}
              placeholder={'{ "@type": "FAQPage", … }'}
              onChange={(e) => {
                const v = e.target.value;
                setJson(v);
                if (!v.trim()) {
                  setJsonError(false);
                  return onChange({ jsonLd: null });
                }
                try {
                  onChange({ jsonLd: JSON.parse(v) });
                  setJsonError(false);
                } catch {
                  setJsonError(true);
                }
              }}
            />
          </Field>
        </Section>
      </div>

      <div className="flex flex-col gap-4">
        <Section icon={<CheckCircle />} title={t("checks")} aside={<span className="text-body-sm text-fg-muted tabular-nums">{t("checksDone", { done, total: checks.length })}</span>}>
          <ul className="flex flex-col gap-2">
            {checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-body-sm">
                {c.ok ? <CheckCircle weight="fill" aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />}
                <span className={c.ok ? "text-fg" : "text-fg-muted"}>
                  <span className="sr-only">{t(c.ok ? "checkDone" : "checkOpen")}: </span>
                  {t(`check.${c.key}`)}
                  {!c.ok && c.needs === "focus" && !focus ? <span className="block text-caption text-fg-subtle">{t("check.needsFocus")}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section icon={<ShareNetwork />} title={t("socialPreview")}>
          {/* A link preview as social networks draw it: image, site, title, description. */}
          <div role="img" aria-label={t("socialPreview")} className="overflow-hidden rounded-field border border-line bg-raised">
            {ogImage ? <img src={mediaUrl(ogImage)} alt="" className="aspect-[1.91/1] w-full object-cover" /> : <div className="grid aspect-[1.91/1] place-items-center bg-sunken text-body-sm text-fg-subtle">{t("noImage")}</div>}
            <div className="flex flex-col gap-0.5 p-3" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
              <span dir="ltr" className="text-start text-caption uppercase text-fg-subtle">
                orgtik.ch
              </span>
              <span className="line-clamp-2 text-body font-medium text-fg">{ogTitle || t("noTitle")}</span>
              <span className="line-clamp-2 text-body-sm text-fg-muted">{ogDescription}</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
