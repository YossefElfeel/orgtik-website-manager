"use client";
import { useTranslations } from "next-intl";
import { MediaPicker } from "@/components/media/MediaPicker";
import type { MediaRef } from "@/store/api";

export function SectionAttachments({
  items,
  onChange,
  disabled,
  disabledReason,
}: {
  items: MediaRef[];
  onChange: (items: MediaRef[]) => void;
  disabled: boolean;
  disabledReason?: string;
}) {
  const t = useTranslations("Improvements");
  return (
    <details open className="mt-6 rounded-card border border-line p-4">
      <summary className="cursor-pointer text-label">
        {t("media")}
        {items.length ? ` (${items.length})` : ""}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {disabledReason ? (
          <p className="text-body-sm text-fg-muted">{disabledReason}</p>
        ) : null}
        {!items.length && disabled ? (
          <p className="text-body-sm text-fg-muted">{t("noMediaAttached")}</p>
        ) : null}
        {items.map((item, index) => (
          <MediaPicker
            key={index}
            value={item.src}
            disabled={disabled}
            onChange={(src, media) =>
              onChange(
                src
                  ? items.map((current, n) =>
                      n === index
                        ? {
                            src,
                            alt: media?.alt ?? current.alt,
                            focal: media?.focal ?? current.focal,
                          }
                        : current,
                    )
                  : items.filter((_, n) => n !== index),
              )
            }
          />
        ))}
        {!disabled && items.length < 10 ? (
          <MediaPicker
            value=""
            onChange={(src, media) =>
              src &&
              onChange([
                ...items,
                { src, alt: media?.alt ?? {}, focal: media?.focal },
              ])
            }
          />
        ) : null}
      </div>
    </details>
  );
}
