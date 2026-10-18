"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Quotes, UserCircle } from "@phosphor-icons/react";
import {
  Badge,
  Field,
  Input,
  NumberField,
  Select,
  Textarea,
} from "@orgtik/ui";
import { MediaPicker } from "@/components/media/MediaPicker";
import { mediaUrl } from "@/lib/env";
import type { EditorContext } from "./BlockEditor";
import type { Locale, MediaItem } from "@/store/api";

type Words = Record<string, unknown>;
export function ReviewEditor({
  value,
  fallback,
  onChange,
  ctx,
  photo,
  focal,
  alt,
  onPhoto,
  onAlt,
  sample,
  position,
  relatedEntry,
  onSettings,
  relatedOptions,
  additionalMedia,
}: {
  value: Words;
  fallback: Words;
  onChange: (value: Words) => void;
  ctx: EditorContext;
  photo: string;
  focal?: { x: number; y: number };
  alt: string;
  onPhoto: (src: string, media?: MediaItem) => void;
  onAlt: (value: string) => void;
  sample: boolean;
  position: number;
  relatedEntry: string;
  onSettings: (patch: {
    sample?: boolean;
    position?: number;
    relatedEntry?: string;
  }) => void;
  relatedOptions: { value: string; label: string }[];
  additionalMedia: ReactNode;
}) {
  const t = useTranslations("Improvements"),
    tf = useTranslations("Fields"),
    te = useTranslations("Editor");
  const text = (key: string) =>
    typeof value[key] === "string" ? (value[key] as string) : "";
  const hint = (key: string) =>
    ctx.lang !== "en" && typeof fallback[key] === "string"
      ? (fallback[key] as string)
      : undefined;
  const locked = ctx.readOnly || ctx.lang !== "en";
  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 rounded-card border border-line bg-raised p-4 sm:p-6">
        <h2 className="font-display text-title-sm">{t("reviewContent")}</h2>
        <p className="mt-2 text-body-sm text-fg-muted">
          {t("reviewContentHelp")}
        </p>
        <div className="mt-5 grid gap-4">
          <Field
            label={tf("reviewQuote")}
            required
            error={ctx.errors.quote ? te("errorRequired") : undefined}
          >
            <Textarea
              rows={5}
              value={text("quote")}
              placeholder={hint("quote")}
              lang={ctx.lang}
              dir="auto"
              readOnly={ctx.readOnly}
              onChange={(event) =>
                onChange({ ...value, quote: event.target.value })
              }
            />
          </Field>
          <Field label={tf("reviewAuthor")} required>
            <Input
              value={text("name")}
              placeholder={hint("name")}
              lang={ctx.lang}
              dir="auto"
              readOnly={ctx.readOnly}
              onChange={(event) =>
                onChange({ ...value, name: event.target.value })
              }
            />
          </Field>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {(["role", "company"] as const).map((key) => (
              <Field
                key={key}
                optional
                label={tf(key === "role" ? "reviewRole" : "reviewCompany")}
              >
                <Input
                  value={text(key)}
                  placeholder={hint(key)}
                  lang={ctx.lang}
                  dir="auto"
                  readOnly={ctx.readOnly}
                  onChange={(event) =>
                    onChange({ ...value, [key]: event.target.value })
                  }
                />
              </Field>
            ))}
          </div>
        </div>
        <section
          className="mt-6 min-w-0 border-t border-line pt-6"
          aria-label={t("reviewPhoto")}
        >
          <h3 className="text-label">{t("reviewPhoto")}</h3>
          <p className="mb-4 mt-1 text-body-sm text-fg-muted">
            {t("reviewPhotoHelp")}
          </p>
          <MediaPicker
            imagesOnly
            value={photo}
            disabled={locked}
            onChange={onPhoto}
          />
          {ctx.errors["image.src"] ? (
            <p role="alert" className="mt-2 text-danger">
              {te("errorRequired")}
            </p>
          ) : null}
          {locked && !ctx.readOnly ? (
            <p className="mt-2 text-caption text-fg-muted">
              {t("mediaLanguageHelp")}
            </p>
          ) : null}
          <Field
            className="mt-4 min-w-0"
            label={te("altText")}
            description={te("altHelp")}
          >
            <Textarea
              rows={3}
              className="w-full"
              value={alt}
              lang={ctx.lang as Locale}
              dir="auto"
              readOnly={ctx.readOnly}
              onChange={(event) => onAlt(event.target.value)}
            />
          </Field>
        </section>
        <section
          className="mt-6 border-t border-line pt-6"
          aria-label={t("reviewAdditionalMedia")}
        >
          <h3 className="text-label">{t("reviewAdditionalMedia")}</h3>
          <p className="mb-4 mt-1 text-body-sm text-fg-muted">
            {t("reviewAdditionalMediaHelp")}
          </p>
          {additionalMedia}
        </section>
        <section
          className="mt-6 border-t border-line pt-6"
          aria-label={t("reviewDisplay")}
        >
          <h3 className="text-label">{t("reviewDisplay")}</h3>
          <p className="mt-1 text-body-sm text-fg-muted">
            {t("reviewDisplayHelp")}
          </p>
          <div role="note" className="mt-4 rounded-field bg-sunken p-3"><p className="text-label">{t("sample")}: {sample ? t("yes") : t("no")}</p><p className="mt-1 text-caption text-fg-muted">{t("reviewSampleReadOnly")}</p></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <Field label={t("order")} description={t("reviewOrderHelp")}>
              <NumberField
                min={0}
                value={position}
                disabled={locked}
                onValueChange={(position) =>
                  onSettings({ position: position ?? 0 })
                }
              />
            </Field>
            <Field optional label={t("relatedEntry")}>
              <Select
                disabled={locked}
                value={relatedEntry || "none"}
                onValueChange={(value) =>
                  onSettings({
                    relatedEntry: value === "none" ? "" : (value ?? ""),
                  })
                }
                options={[
                  { value: "none", label: t("reviewUnlinked") },
                  ...relatedOptions,
                ]}
              />
            </Field>
          </div>
          {ctx.lang !== "en" ? (
            <p className="mt-3 text-caption text-fg-muted">
              {te("sharedNote")}
            </p>
          ) : null}
        </section>
      </div>
      <aside
        className="min-w-0 rounded-card border border-line bg-raised p-5 xl:sticky xl:top-4"
        aria-label={t("reviewPreview")}
      >
        <h2 className="text-label">{t("reviewPreview")}</h2>
        <p className="mt-1 text-caption text-fg-muted">
          {t("reviewPreviewHelp")}
        </p>
        <Quotes
          aria-hidden
          className="mb-3 mt-6 size-8 text-fg-brand"
          weight="fill"
        />
        <blockquote
          dir="auto"
          className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-display text-title-sm leading-relaxed"
        >
          {text("quote") || t("reviewQuoteEmpty")}
        </blockquote>
        <div className="mt-6 flex items-center gap-3 border-t border-line pt-4">
          {photo ? (
            <img
              src={mediaUrl(photo)}
              alt=""
              className="size-12 shrink-0 rounded-pill object-cover"
              style={{
                objectPosition: `${focal?.x ?? 50}% ${focal?.y ?? 50}%`,
              }}
            />
          ) : (
            <UserCircle
              aria-hidden
              className="size-12 shrink-0 text-fg-muted"
            />
          )}
          <div className="min-w-0">
            <p dir="auto" className="break-words font-semibold">
              {text("name") || t("reviewAuthorEmpty")}
            </p>
            <p
              dir="auto"
              className="mt-1 break-words text-caption text-fg-muted"
            >
              {[text("role"), text("company")].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {sample ? (
          <Badge className="mt-4" tone="warning">
            {t("sample")}
          </Badge>
        ) : null}
      </aside>
    </div>
  );
}
