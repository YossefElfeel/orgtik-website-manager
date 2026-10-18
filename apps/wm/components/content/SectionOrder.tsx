"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, DotsSixVertical } from "@phosphor-icons/react";
import { IconButton } from "@orgtik/ui";

export function SectionOrder({
  items,
  onChange,
  disabled,
  title,
}: {
  items: { key: string; label: string }[];
  onChange: (keys: string[]) => void;
  disabled: boolean;
  title?: string;
}) {
  const t = useTranslations("Improvements");
  const [dragged, setDragged] = useState<string | null>(null);
  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= items.length || from < 0) return;
    const keys = items.map((item) => item.key);
    const [key] = keys.splice(from, 1);
    keys.splice(to, 0, key);
    onChange(keys);
  };
  return (
    <details className="rounded-card border border-line bg-raised p-4">
      <summary className="cursor-pointer text-label">{title ?? t("sections")}</summary>
      <ol className="mt-3 flex flex-col gap-2">
        {items.map((item, index) => (
          <li
            key={item.key}
            draggable={!disabled}
            onDragStart={(event) => { event.dataTransfer.setData("text/plain", item.key); event.dataTransfer.effectAllowed = "move"; setDragged(item.key); }}
            onDragOver={(event) => {
              if (!disabled) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              move(
                items.findIndex((item) => item.key === dragged),
                index,
              );
              setDragged(null);
            }}
            onDragEnd={() => setDragged(null)}
            className="flex items-center gap-3 rounded-field bg-sunken px-3 py-2"
          >
            <DotsSixVertical aria-hidden className="text-fg-muted" />
            <span className="min-w-0 flex-1 text-body-sm" dir="auto">
              {item.label}
            </span>
            <IconButton
              label={`${t("moveUp")}: ${item.label}`}
              icon={<ArrowUp />}
              disabled={disabled || index === 0}
              onClick={() => move(index, index - 1)}
            />
            <IconButton
              label={`${t("moveDown")}: ${item.label}`}
              icon={<ArrowDown />}
              disabled={disabled || index === items.length - 1}
              onClick={() => move(index, index + 1)}
            />
          </li>
        ))}
      </ol>
    </details>
  );
}
