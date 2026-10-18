"use client";
import { useId, type ReactNode } from "react";
import { Field, Input, Textarea } from "@orgtik/ui";
import { useTranslations } from "next-intl";
import { ValueEditor, type EditorContext } from "./BlockEditor";
import type { Node } from "@/lib/caseStudySchema";
import type { Entry, Locale } from "@/store/api";
import { copyParts } from "@/lib/richCopy";

export type PageField = { record: string; path: string; label: string; initial?: string; link?: boolean; template?: boolean };
export function PageFields({ fields, records, lang, edits, onChange, ctx, cardTitle }: {
  fields: PageField[]; records: Entry[]; lang: Locale;
  edits: Record<string, Partial<Record<Locale, Record<string, unknown>>>>;
  onChange: (id: string, words: Record<string, unknown>) => void; ctx: EditorContext; cardTitle?: string;
}) {
  const t = useTranslations("Fields");
  const ti = useTranslations("Improvements");
  const content = <div className={cardTitle ? "grid gap-4 sm:grid-cols-2" : "grid max-w-3xl gap-4"}>
    {fields.map(field => {
      const entry = records.find(item => item.id === field.record);
      if (!entry) return null;
      const [block, slot] = field.path.split(".");
      const words = edits[field.record]?.[lang] ?? entry.content.locales[lang] ?? entry.content.locales.en ?? {};
      const values = (words[block] ?? {}) as Record<string, unknown>;
      const fallback = (entry.content.locales.en?.[block] ?? {}) as Record<string, unknown>;
      const value = values[slot] ?? (lang === "en" ? field.initial : undefined) ?? "";
      const fullWidth = cardTitle && ["description", "header", "headerAccent"].includes(field.label) ? "sm:col-span-2" : undefined;
      if (!field.link && /<m\d+>|<br\s*\/?>/.test(String(value))) return <div key={`${field.record}.${field.path}`} className={fullWidth}><ValueEditor node={{kind:"rich",label:field.label,long:String(value).length>100}} value={value} fallback={fallback[slot]} path={field.path} onChange={next=>onChange(field.record,{...words,[block]:{...values,[slot]:next}})} ctx={ctx} /></div>;
      return <Field key={`${field.record}.${field.path}`} className={fullWidth} label={t.has(field.label) ? t(field.label) : field.label} description={field.template ? ti("templateField") : undefined}>
        {field.label === "subheading" ? <Textarea rows={3} value={String(value)} placeholder={String(fallback[slot] ?? field.initial ?? "")} dir="auto" lang={lang} disabled={ctx.readOnly} onChange={event=>onChange(field.record,{...words,[block]:{...values,[slot]:event.target.value}})} /> : <Input value={String(value)} placeholder={String(fallback[slot] ?? field.initial ?? "")} dir={field.link ? "ltr" : "auto"} lang={lang} readOnly={field.template} disabled={ctx.readOnly || field.link && ctx.structureLocked} onChange={event => onChange(field.record, { ...words, [block]: { ...values, [slot]: event.target.value } })} />}
      </Field>;
    })}
  </div>;
  return cardTitle ? <PageSectionCard title={cardTitle}>{content}</PageSectionCard> : content;
}

export function PageSectionCard({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-card border border-line bg-raised p-5">
      <h3 id={id} className="mb-4 text-title-sm font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

type CardGroup = { label?: string; titleKey?: string; keys: string[] };
const HOME_CARD_GROUPS: Record<string, CardGroup[]> = {
  "two-sides": [
    { label: "sectionIntro", keys: ["div", "h2", "p"] },
    { label: "buildGrow", keys: ["image-slot@placeholder", "div-2", "div-3", "h3", "p-2", "li", "li-2", "li-3", "li-4", "li-5"] },
    { label: "runBetter", keys: ["image-slot@placeholder-2", "div-4", "div-5", "h3-2", "p-3", "li-6", "li-7", "li-8", "li-9", "li-10", "li-11"] },
  ],
  work: [
    { label: "sectionIntro", keys: ["div", "h2", "p", "a"] },
    { titleKey: "div-2", keys: ["image-slot@placeholder", "div-2", "div-3", "h3", "p-2"] },
    { titleKey: "div-4", keys: ["image-slot@alt", "div-4", "div-5", "h3-2", "p-3"] },
    { titleKey: "div-6", keys: ["image-slot@alt-2", "div-6", "div-7", "h3-3", "p-4"] },
    { titleKey: "div-8", keys: ["image-slot@alt-3", "div-8", "div-9", "h3-4", "p-5"] },
  ],
};

/** Cards share the original flat copy keys; visual grouping never changes saved content. */
export function PageCards({ pageId, section, node, value, fallback, onChange, ctx }: {pageId: string; section: string; node: Node; value: unknown; fallback?: unknown; onChange: (value: unknown) => void; ctx: EditorContext}) {
  const t = useTranslations("Fields");
  if (node.kind === "list") return <ValueEditor node={node} value={value} fallback={fallback} onChange={onChange} path={section} ctx={ctx} cardTitleKey={section === "faqs" ? "question" : undefined} />;
  if (node.kind !== "group") return null;
  const words = (value ?? {}) as Record<string, unknown>;
  const english = (fallback ?? {}) as Record<string, unknown>;
  if (pageId === "pg_home" && section === "services") return (
    <div className="flex flex-col gap-5">
      <PageSectionCard title={t("sectionIntro")}>
        <ValueEditor node={node.fields.services} value={words.services} fallback={english.services} onChange={next => onChange({ ...words, services: next })} path="services" ctx={ctx} />
      </PageSectionCard>
      <ValueEditor node={node.fields.homeServices} value={words.homeServices} fallback={english.homeServices} onChange={next => onChange({ ...words, homeServices: next })} path="homeServices" ctx={ctx} cardTitleKey="title" />
    </div>
  );
  const groups: CardGroup[] = pageId === "pg_home" ? HOME_CARD_GROUPS[section] ?? [
    { label: "sectionIntro", keys: Object.keys(node.fields) },
  ] : [
    { label: "sectionIntro", keys: ["div", "h2", "p"] },
    { label: "purpose", keys: ["image-slot@placeholder", "h3", "p-2"] },
    ...[2, 3, 4].map((n, index) => ({ label: `goal${index + 1}`, keys: [`div-${n}`] })),
  ];
  const assigned = new Set(groups.flatMap(group => group.keys));
  const remaining = Object.keys(node.fields).filter(key => !assigned.has(key));
  return <div className="flex flex-col gap-5">{groups.map((group, index) => {
    const keys = [...group.keys, ...(index === 0 ? remaining : [])].filter(key => node.fields[key]);
    if (!keys.length) return null;
    const title = group.label ? t(group.label) : copyParts(String(words[group.titleKey!] || english[group.titleKey!] || "")).find(part => !part.fixed && part.text.trim())?.text.trim() || t("overview");
    return <PageSectionCard key={group.label ?? group.titleKey} title={title}>
      <ValueEditor node={{ kind: "group", fields: Object.fromEntries(keys.map(key => [key, node.fields[key]])) }} value={value} fallback={fallback} onChange={onChange} path={section} ctx={ctx} />
    </PageSectionCard>;
  })}</div>;
}
