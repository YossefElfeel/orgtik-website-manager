"use client";
import { useId, useRef, useState, type DragEvent } from "react";
import { File as FileIcon, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useFormatter, useStrings } from "../provider/OrgtikProvider.js";
import { MediaFilePreview } from "./MediaFilePreview.js";

export type FileFieldProps = {
  label: string;
  value: File[];
  onChange: (files: File[]) => void;
  /** Accepted types, as for <input accept>: "image/*,.pdf". */
  accept?: string;
  /** Largest file allowed, in bytes. */
  maxSize?: number;
  multiple?: boolean;
  /** Most files allowed at once. */
  maxFiles?: number;
  description?: string;
  disabled?: boolean;
  className?: string;
};

const matches = (file: File, accept?: string) => {
  if (!accept) return true;
  return accept.split(",").some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule);
    if (rule.endsWith("/*")) return file.type.startsWith(rule.slice(0, -1));
    return file.type === rule;
  });
};

/**
 * Choose files by dropping them or with a real file input (a keyboard and screen-reader path,
 * not a click-only drop zone). Refused files are named with the reason, not dropped silently.
 */
export function FileField({ label, value, onChange, accept, maxSize, multiple = true, maxFiles, description, disabled, className }: FileFieldProps) {
  const t = useStrings();
  const f = useFormatter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [refused, setRefused] = useState<string[]>([]);

  const take = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const reasons: string[] = [];
    const ok = incoming.filter((file) => {
      if (!matches(file, accept)) return reasons.push(t("fileTypeRefused", { name: file.name })), false;
      if (maxSize && file.size > maxSize) return reasons.push(t("fileTooLarge", { name: file.name, max: f.bytes(maxSize) })), false;
      return true;
    });
    let next = multiple ? [...value, ...ok] : ok.slice(0, 1);
    if (maxFiles && next.length > maxFiles) {
      reasons.push(t("tooManyFiles", { max: maxFiles }));
      next = next.slice(0, maxFiles);
    }
    setRefused(reasons);
    onChange(next);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) take(e.dataTransfer.files);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-label text-fg">
        {label}
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-control bg-raised px-6 py-8 text-center transition-colors",
          over && "border-action-primary bg-brand-subtle",
          disabled && "opacity-50",
        )}
      >
        <UploadSimple aria-hidden="true" className="size-6 text-fg-brand" />
        <p className="text-body text-fg">
          {t("dropFiles")}{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={() => input.current?.click()}
            className="rounded-sm font-semibold text-fg-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {t("chooseFiles")}
          </button>
        </p>
        {description ? <p className="text-caption text-fg-muted">{description}</p> : null}
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) take(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {refused.length ? (
        <ul role="alert" className="flex flex-col gap-1 text-caption text-danger">
          {refused.map((r, i) => (
            <li key={i} className="flex items-start gap-1">
              <WarningCircle aria-hidden="true" weight="fill" className="mt-[0.15em] size-[1.1em] shrink-0" />
              <span dir="auto">{r}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {value.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-raised">
          {value.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-3 px-3 py-2">
              {/^(image|video)\//.test(file.type) ? <MediaFilePreview file={file} /> : <FileIcon aria-hidden="true" className="size-5 shrink-0 text-fg-subtle" />}
              <span dir="auto" className="min-w-0 flex-1 truncate text-body text-fg">
                {file.name}
              </span>
              <span className="text-caption text-fg-muted tabular-nums">{f.bytes(file.size)}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label={t("removeItem", { label: file.name })}
                className="grid size-7 shrink-0 place-items-center rounded-pill text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-40"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
