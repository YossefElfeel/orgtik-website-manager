"use client";
import { createElement, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Input, Textarea } from "@orgtik/ui";
import { copyParts, copyText, readableCopy, replaceCopyText } from "@/lib/richCopy";

function FormattedCopy({
  value,
  fixedValues,
}: {
  value: string;
  fixedValues?: string[];
}) {
  const stack: { tag: string; children: ReactNode[] }[] = [
    { tag: "span", children: [] },
  ];
  for (const [index, part] of copyParts(value).entries()) {
    const tag = /^<(\/?)([a-z][a-z0-9]*)\/?\s*>$/i.exec(part.text);
    if (!tag) stack.at(-1)!.children.push(readableCopy(part.text, fixedValues));
    else if (tag[2] === "br") stack.at(-1)!.children.push(<br key={index} />);
    else if (!tag[1])
      stack.push({
        tag: ["em", "strong", "b", "i", "u", "sup", "sub"].includes(tag[2])
          ? tag[2]
          : "span",
        children: [],
      });
    else if (stack.length > 1) {
      const frame = stack.pop()!;
      stack
        .at(-1)!
        .children.push(
          createElement(frame.tag, { key: index }, ...frame.children),
        );
    }
  }
  while (stack.length > 1) {
    const frame = stack.pop()!;
    stack.at(-1)!.children.push(...frame.children);
  }
  return <>{stack[0].children}</>;
}

export function RichCopyEditor({
  value,
  fallback = "",
  onChange,
  disabled,
  lang,
  label,
  long,
  fixedValues,
  singleField = false,
}: {
  value: string;
  fallback?: string;
  onChange: (value: string) => void;
  disabled: boolean;
  lang: string;
  label: string;
  long?: boolean;
  fixedValues?: string[];
  singleField?: boolean;
}) {
  const t = useTranslations("Improvements");
  const source = value || fallback;
  const parts = copyParts(source);
  const wholeText = singleField ? copyText(source) : "";
  return (
    <div className="flex flex-col gap-2">
      {singleField ? (
        wholeText.length > 100 ? <Textarea rows={2} aria-label={label} lang={lang} dir="auto" disabled={disabled} value={wholeText} onChange={event => onChange(replaceCopyText(source, event.target.value))} />
          : <Input aria-label={label} lang={lang} dir="auto" disabled={disabled} value={wholeText} onChange={event => onChange(replaceCopyText(source, event.target.value))} />
      ) : parts.map((part, index) =>
        part.fixed || (!part.text.trim() && parts.length > 1) ? null : long ? (
          <Textarea
            key={index}
            rows={2}
            aria-label={`${label} ${index + 1}`}
            lang={lang}
            dir="auto"
            disabled={disabled}
            value={part.text}
            onChange={(event) =>
              onChange(
                parts
                  .map((item, n) =>
                    n === index ? event.target.value : item.text,
                  )
                  .join(""),
              )
            }
          />
        ) : (
          <Input
            key={index}
            aria-label={`${label} ${index + 1}`}
            lang={lang}
            dir="auto"
            disabled={disabled}
            value={part.text}
            onChange={(event) =>
              onChange(
                parts
                  .map((item, n) =>
                    n === index ? event.target.value : item.text,
                  )
                  .join(""),
              )
            }
          />
        ),
      )}
      {parts.some((part) => part.fixed) ? (
        <div className="rounded-field bg-sunken p-3 text-body-sm" role="note">
          <span className="mb-1 block text-caption text-fg-muted">
            {t("formattedPreview")}
          </span>
          <p dir="auto" lang={lang} className="whitespace-pre-wrap">
            <FormattedCopy value={source} fixedValues={fixedValues} />
          </p>
          <p className="mt-2 text-caption text-fg-muted">
            {t("formattingProtected")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
