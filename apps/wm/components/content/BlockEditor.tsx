"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import {
  Button,
  Field,
  IconButton,
  Input,
  NumberField,
  Switch,
  Textarea,
  cn,
} from "@orgtik/ui";
import type { Node } from "@/lib/caseStudySchema";
import { RichCopyEditor } from "./RichCopyEditor";
import { MediaPicker } from "@/components/media/MediaPicker";
import { IconPicker } from "./IconPicker";

// A schema-driven editor for one language of a case study. Rules (D-032):
// - Structure (adding, removing and reordering steps, rows and points) is edited in English; the
//   other languages translate the text in the same places. `structureLocked` turns it off.
// - Numbers are language-neutral: set in English, copied by the API. `numbersLocked` shows them
//   read-only.
// - `fallback` is the English value at the same place; empty fields show it as a hint.

export type EditorContext = {
  /** The language being edited: inputs carry it, the labels around them stay in the UI's language. */
  lang: string;
  /** The currency amounts are in (pricing). */
  currency?: string;
  /** The whole editor is read-only: the role can't edit content. */
  readOnly: boolean;
  structureLocked: boolean;
  numbersLocked: boolean;
  /** Field errors from the API, keyed by path ("name", "approach.steps.0.title"). */
  errors: Record<string, string>;
};

type Props = {
  node: Node;
  value: unknown;
  fallback?: unknown;
  onChange: (v: unknown) => void;
  path: string;
  ctx: EditorContext;
  /** Name each list item's card from its content, keeping the stored list unchanged. */
  cardTitleKey?: string;
};

/** An empty value of a node's shape, for "Add step". */
export function emptyOf(node: Node): unknown {
  switch (node.kind) {
    case "number":
      return 0;
    case "lines":
      return ["", ""];
    case "tags":
    case "numbers":
    case "list":
    case "series":
      return [];
    case "toggle":
      return false;
    case "pair":
      return ["", node.secondKind === "number" ? 0 : ""];
    case "group":
      return Object.fromEntries(
        Object.entries(node.fields).map(([k, n]) => [k, emptyOf(n)]),
      );
    default:
      return "";
  }
}

const LEAF: Node["kind"][] = [
  "text",
  "longtext",
  "rich",
  "color",
  "image",
  "icon",
  "number",
];
const str = (v: unknown) =>
  typeof v === "string" ? v : v == null ? "" : String(v);
const at = (v: unknown, k: string | number) =>
  v && typeof v === "object"
    ? (v as Record<string | number, unknown>)[k]
    : undefined;

function useLabel() {
  const t = useTranslations("Fields");
  return (key: string) => (t.has(key) ? t(key) : key);
}

/** A field name as it reads inside a sentence: "Add paragraph", but "Absatz hinzufügen" and "Add KPI". */
function useInline() {
  const locale = useLocale();
  return (name: string) =>
    locale === "de" || /^.[A-Z]/.test(name)
      ? name
      : name.charAt(0).toLocaleLowerCase(locale) + name.slice(1);
}

function ErrorFor({
  ctx,
  path,
  children,
}: {
  ctx: EditorContext;
  path: string;
  children: (error?: string) => React.ReactNode;
}) {
  const tw = useTranslations("Editor");
  const code = ctx.errors[path];
  const message =
    code === "required"
      ? tw("errorRequired")
      : code === "slug_format"
        ? tw("errorSlug")
        : code === "too_long"
          ? tw("errorTooLong")
          : code === "marks_changed"
            ? tw("errorMarks")
            : code;
  return <>{children(message)}</>;
}

export function ValueEditor({
  node,
  value,
  fallback,
  onChange,
  path,
  ctx,
  cardTitleKey,
}: Props) {
  const label = useLabel();
  const inline = useInline();
  const tw = useTranslations("Editor");
  const id = useId();
  // Values in hints are addresses and marks: isolated (LRI…PDI) so they keep their order in RTL.
  const iso = (v: string | number) => `\u2066${v}\u2069`;
  const hintOf = (n: Node) =>
    "hint" in n && n.hint
      ? tw(
          `hints.${n.hint.key}`,
          Object.fromEntries(
            Object.entries(n.hint.values ?? {}).map(([k, v]) => [k, iso(v)]),
          ),
        )
      : undefined;

  switch (node.kind) {
    case "image":
      return <Field label={label(node.label)}><MediaPicker imagesOnly value={str(value)} onChange={onChange} disabled={ctx.readOnly || ctx.numbersLocked} /></Field>;
    case "icon":
      return <Field label={label(node.label)}><IconPicker value={str(value)} onChange={onChange} disabled={ctx.readOnly || ctx.numbersLocked} /></Field>;
    case "text":
    case "color":
      return (
        <ErrorFor ctx={ctx} path={path}>
          {(error) => (
            <Field
              label={label(node.label)}
              error={error}
              description={
                hintOf(node) ??
                (node.kind === "text" && node.neutral && ctx.numbersLocked
                  ? tw("sharedNote")
                  : undefined)
              }
            >
              <Input
                value={str(value)}
                onChange={(e) => onChange(e.target.value)}
                placeholder={str(fallback) || undefined}
                disabled={
                  ctx.readOnly ||
                  (node.kind === "text" &&
                    (node.locked || (node.neutral && ctx.numbersLocked)))
                }
                lang={ctx.lang}
                dir={node.kind === "text" && !node.neutral ? "auto" : "ltr"}
                startIcon={
                  node.kind === "color" &&
                  /^#[0-9a-f]{3,8}$/i.test(str(value)) ? (
                    <span
                      className="block size-4 rounded-md border border-line"
                      style={{ background: str(value) }}
                    />
                  ) : undefined
                }
              />
            </Field>
          )}
        </ErrorFor>
      );
    case "toggle":
      return (
        <Field
          label={label(node.label)}
          description={ctx.numbersLocked ? tw("sharedNote") : undefined}
        >
          <Switch
            checked={value === true}
            disabled={ctx.numbersLocked || ctx.readOnly}
            onCheckedChange={(v) => onChange(v)}
            aria-label={label(node.label)}
          />
        </Field>
      );
    case "rich": {
      // Copy with marks: the words change, the marks stay (the API refuses a changed set).
      const marked = /<[a-z]/i.test(str(value) || str(fallback));
      // Numbered parts ({0}) are where the site puts a name or a count.
      const source = str(value) || str(fallback);
      const placeholder = /\{\d+\}/.exec(source)?.[0];
      const desc = [
        hintOf(node),
        marked
          ? tw("marksHelp", { m: iso("<m1>…</m1>"), em: iso("<em>…</em>") })
          : null,
        placeholder ? tw("placeholdersHelp", { p: iso(placeholder) }) : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const props = {
        value: str(value),
        onChange: (e: { target: { value: string } }) =>
          onChange(e.target.value),
        placeholder: str(fallback) || undefined,
        readOnly: ctx.readOnly,
        lang: ctx.lang,
        dir: "auto" as const,
      };
      return (
        <ErrorFor ctx={ctx} path={path}>
          {(error) => (
            <Field
              label={label(node.label)}
              error={error}
              description={hintOf(node)}
              className={node.long ? "sm:col-span-2" : undefined}
            >
              <RichCopyEditor value={str(value)} fallback={str(fallback)} onChange={onChange} disabled={ctx.readOnly} lang={ctx.lang} label={label(node.label)} long={node.long} fixedValues={node.fixedValues} singleField={node.label === "header" || node.label === "headerAccent" || node.hint?.key === "heading"} />
              {node.fixedValues ? (
                <div role="note" className="mt-2 text-body-sm text-fg-muted">
                  <p>{tw("fixedValuesHelp")}</p>
                  <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {node.fixedValues.map((v, i) => (
                      <li key={i}>
                        <code dir="ltr">{`{${i}} = ${v}`}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Field>
          )}
        </ErrorFor>
      );
    }
    case "longtext":
      return (
        <ErrorFor ctx={ctx} path={path}>
          {(error) => (
            <Field
              label={label(node.label)}
              error={error}
              className="sm:col-span-2"
            >
              <Textarea
                value={str(value)}
                onChange={(e) => onChange(e.target.value)}
                placeholder={str(fallback) || undefined}
                disabled={ctx.readOnly}
                lang={ctx.lang}
                dir="auto"
                rows={3}
              />
            </Field>
          )}
        </ErrorFor>
      );
    case "number":
      return (
        <Field
          label={label(node.label)}
          description={ctx.numbersLocked ? tw("numbersNote") : undefined}
        >
          <NumberField
            value={typeof value === "number" ? value : null}
            onValueChange={(v) => onChange(v ?? 0)}
            min={node.min}
            max={node.max}
            readOnly={ctx.numbersLocked || ctx.readOnly}
            disabled={ctx.numbersLocked || ctx.readOnly}
            format={
              node.unit === "percent"
                ? { style: "unit", unit: "percent" }
                : node.unit === "currency"
                  ? {
                      style: "currency",
                      currency: ctx.currency ?? "CHF",
                      maximumFractionDigits: 0,
                    }
                  : undefined
            }
          />
        </Field>
      );
    case "lines": {
      const lines = Array.isArray(value)
        ? (value as unknown[]).map(str)
        : ["", ""];
      const fb = Array.isArray(fallback)
        ? (fallback as unknown[]).map(str)
        : [];
      return (
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-label text-fg">
            {label(node.label)}
          </legend>
          <p className="mb-1.5 text-body-sm text-fg-muted">{tw("linesHelp")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Input
                key={i}
                aria-label={`${label(node.label)}, ${tw("line", { n: i + 1 })}`}
                value={lines[i] ?? ""}
                placeholder={fb[i] || undefined}
                disabled={ctx.readOnly}
                lang={ctx.lang}
                dir="auto"
                onChange={(e) =>
                  onChange(
                    [0, 1].map((j) =>
                      j === i ? e.target.value : (lines[j] ?? ""),
                    ),
                  )
                }
              />
            ))}
          </div>
        </fieldset>
      );
    }
    case "tags": {
      const items = Array.isArray(value) ? (value as unknown[]).map(str) : [];
      const fb = Array.isArray(fallback)
        ? (fallback as unknown[]).map(str)
        : [];
      return (
        <Field label={label(node.label)} description={tw("tagsHelp")}>
          <Textarea
            value={items.join("\n")}
            placeholder={fb.join("\n") || undefined}
            disabled={ctx.readOnly || (node.neutral && ctx.numbersLocked)}
            lang={ctx.lang}
            dir={node.neutral ? "ltr" : "auto"}
            rows={Math.max(2, items.length || fb.length)}
            onChange={(e) =>
              onChange(
                e.target.value
                  .split("\n")
                  .map((s) => s.trimStart())
                  .filter((s, i, all) => s !== "" || i < all.length - 1),
              )
            }
          />
        </Field>
      );
    }
    case "numbers": {
      const items = Array.isArray(value) ? (value as number[]) : [];
      return (
        <Field
          label={label(node.label)}
          description={ctx.numbersLocked ? tw("numbersNote") : undefined}
        >
          <Input
            dir="ltr"
            value={items.join(", ")}
            readOnly={ctx.numbersLocked || ctx.readOnly}
            onChange={(e) =>
              onChange(
                e.target.value
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n)),
              )
            }
          />
        </Field>
      );
    }
    case "pair": {
      const pair = Array.isArray(value) ? (value as unknown[]) : ["", ""];
      const fb = Array.isArray(fallback) ? (fallback as unknown[]) : [];
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={label(node.first)}>
            <Input
              value={str(pair[0])}
              placeholder={str(fb[0]) || undefined}
              disabled={ctx.readOnly}
              lang={ctx.lang}
              dir="auto"
              onChange={(e) => onChange([e.target.value, pair[1]])}
            />
          </Field>
          <Field label={label(node.second)}>
            <Input
              value={str(pair[1])}
              placeholder={str(fb[1]) || undefined}
              disabled={ctx.readOnly}
              lang={ctx.lang}
              dir="auto"
              onChange={(e) => onChange([pair[0], e.target.value])}
            />
          </Field>
        </div>
      );
    }
    case "series":
      return (
        <SeriesEditor
          node={node}
          value={value}
          fallback={fallback}
          onChange={onChange}
          path={path}
          ctx={ctx}
        />
      );
    case "group":
      return (
        <fieldset
          className={cn(
            "grid gap-4 sm:grid-cols-2",
            node.label && "sm:col-span-2 rounded-card border border-line p-4",
          )}
        >
          {node.label ? (
            <legend className="px-1 text-label text-fg">
              {label(node.label)}
            </legend>
          ) : null}
          {Object.entries(node.fields).map(([k, n]) => (
            <div
              key={k}
              className={cn(
                ["longtext", "lines", "group", "list", "series"].includes(
                  n.kind,
                ) || n.kind === "rich" && (n.label === "description" || n.label === "header" || n.label === "headerAccent" || n.hint?.key === "heading") ? "sm:col-span-2" : undefined,
              )}
            >
              <ValueEditor
                node={n}
                value={at(value, k)}
                fallback={at(fallback, k)}
                onChange={(v) =>
                  onChange({ ...((value as object) ?? {}), [k]: v })
                }
                path={`${path ? path + "." : ""}${k}`}
                ctx={ctx}
              />
            </div>
          ))}
        </fieldset>
      );
    case "list": {
      const items = Array.isArray(value) ? (value as unknown[]) : [];
      const fb = Array.isArray(fallback) ? (fallback as unknown[]) : [];
      const item = label(node.itemLabel);
      const inItem = inline(item);
      // Items with a fixed key (a module, a package the site's code refers to) are a fixed set:
      // their words and numbers change, the list itself doesn't.
      const keyed =
        node.item.kind === "group" &&
        Object.values(node.item.fields).some((f) => "locked" in f && f.locked);
      const fixed = ctx.readOnly || ctx.structureLocked || keyed;
      const move = (i: number, d: -1 | 1) => {
        const next = [...items];
        const [x] = next.splice(i, 1);
        next.splice(i + d, 0, x);
        onChange(next);
      };
      return (
        <section aria-labelledby={id} className="flex flex-col gap-3">
          <h3 id={id} className={cn("text-label text-fg", cardTitleKey && "sr-only")}>
            {label(node.label)}
          </h3>
          {items.length === 0 ? (
            <p className="text-body-sm text-fg-subtle">{tw("emptyList")}</p>
          ) : null}
          <ol className="flex flex-col gap-3">
            {items.map((v, i) =>
              // A list of single fields (paragraphs, say) is a column of fields, not of cards.
              LEAF.includes(node.item.kind) ? (
                <li key={i} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <ValueEditor
                      node={{ ...node.item, label: `${item} ${i + 1}` } as Node}
                      value={v}
                      fallback={fb[i]}
                      onChange={(nv) =>
                        onChange(items.map((x, j) => (j === i ? nv : x)))
                      }
                      path={`${path}.${i}`}
                      ctx={ctx}
                    />
                  </div>
                  {fixed ? null : (
                    <span className="mt-7 flex items-center gap-1">
                      <IconButton
                        size="sm"
                        label={tw("moveUp", { item: inItem, n: i + 1 })}
                        icon={<ArrowUp />}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      />
                      <IconButton
                        size="sm"
                        label={tw("moveDown", { item: inItem, n: i + 1 })}
                        icon={<ArrowDown />}
                        disabled={i === items.length - 1}
                        onClick={() => move(i, 1)}
                      />
                      <IconButton
                        size="sm"
                        label={tw("removeItem", { item: inItem, n: i + 1 })}
                        icon={<Trash />}
                        onClick={() =>
                          onChange(items.filter((_, j) => j !== i))
                        }
                      />
                    </span>
                  )}
                </li>
              ) : (
                <li
                  key={i}
                  className={cn("flex min-w-0 flex-col gap-3 rounded-card border border-line bg-raised p-4", cardTitleKey && "gap-4 p-5")}
                >
                  <div className="flex items-center justify-between gap-2">
                    {cardTitleKey ? (
                      <h4 className="min-w-0 text-title-sm font-semibold text-fg">
                        {str(at(v, cardTitleKey)) || str(at(fb[i], cardTitleKey)) || `${item} ${i + 1}`}
                      </h4>
                    ) : (
                      <span className="text-caption font-semibold text-fg-muted">{item} {i + 1}</span>
                    )}
                    {fixed ? null : (
                      <span className="flex shrink-0 items-center gap-1">
                        <IconButton
                          size="sm"
                          label={tw("moveUp", { item: inItem, n: i + 1 })}
                          icon={<ArrowUp />}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        />
                        <IconButton
                          size="sm"
                          label={tw("moveDown", { item: inItem, n: i + 1 })}
                          icon={<ArrowDown />}
                          disabled={i === items.length - 1}
                          onClick={() => move(i, 1)}
                        />
                        <IconButton
                          size="sm"
                          label={tw("removeItem", { item: inItem, n: i + 1 })}
                          icon={<Trash />}
                          onClick={() =>
                            onChange(items.filter((_, j) => j !== i))
                          }
                        />
                      </span>
                    )}
                  </div>
                  <ValueEditor
                    node={node.item}
                    value={v}
                    fallback={fb[i]}
                    onChange={(nv) =>
                      onChange(items.map((x, j) => (j === i ? nv : x)))
                    }
                    path={`${path}.${i}`}
                    ctx={ctx}
                  />
                </li>
              ),
            )}
          </ol>
          {fixed ? null : (
            <Button
              variant="secondary"
              size="sm"
              startIcon={<Plus />}
              className="self-start"
              onClick={() => onChange([...items, emptyOf(node.item)])}
            >
              {tw("addItem", { item: inItem })}
            </Button>
          )}
        </section>
      );
    }
  }
}

/** Chart points as [label, value] rows, with a live preview of their shape. */
function SeriesEditor({
  node,
  value,
  fallback,
  onChange,
  ctx,
}: Props & { node: Extract<Node, { kind: "series" }> }) {
  const label = useLabel();
  const inline = useInline();
  const tw = useTranslations("Editor");
  const id = useId();
  const points = Array.isArray(value) ? (value as [string, number][]) : [];
  const fb = Array.isArray(fallback) ? (fallback as [string, number][]) : [];
  const max = Math.max(1, ...points.map((p) => Number(p[1]) || 0));
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-label text-fg">
        {label(node.label)}
      </h3>
      {points.length ? (
        <div
          aria-hidden="true"
          className="flex h-24 items-end gap-1.5 rounded-field bg-sunken p-3"
        >
          {points.map((p, i) => (
            <span key={i} className="flex flex-1 flex-col items-center gap-1">
              <span
                className="w-full rounded-t-md bg-fg-brand"
                style={{
                  height: `${Math.max(4, ((Number(p[1]) || 0) / max) * 64)}px`,
                }}
              />
              <span className="text-micro text-fg-subtle">{p[0]}</span>
            </span>
          ))}
        </div>
      ) : null}
      {points.length ? (
        <div
          aria-hidden="true"
          className="grid grid-cols-[1fr_8rem_2rem] gap-2 text-caption text-fg-muted"
        >
          <span>{label(node.first)}</span>
          <span>{label(node.second)}</span>
        </div>
      ) : null}
      <ol className="flex flex-col gap-2">
        {points.map((p, i) => (
          <li
            key={i}
            className="grid grid-cols-[1fr_8rem_2rem] items-center gap-2"
          >
            <Input
              aria-label={`${label(node.first)} ${i + 1}`}
              value={String(p[0] ?? "")}
              placeholder={String(fb[i]?.[0] ?? "") || undefined}
              disabled={ctx.readOnly}
              lang={ctx.lang}
              dir="auto"
              onChange={(e) =>
                onChange(
                  points.map((x, j) => (j === i ? [e.target.value, x[1]] : x)),
                )
              }
            />
            <NumberField
              aria-label={`${label(node.second)} ${i + 1}`}
              steppers={false}
              value={Number(p[1]) || 0}
              readOnly={ctx.numbersLocked || ctx.readOnly}
              disabled={ctx.numbersLocked || ctx.readOnly}
              onValueChange={(v) =>
                onChange(points.map((x, j) => (j === i ? [x[0], v ?? 0] : x)))
              }
              format={{ maximumFractionDigits: 2 }}
            />
            {ctx.structureLocked ? (
              <span />
            ) : (
              <IconButton
                size="sm"
                label={tw("removeItem", {
                  item: inline(label("point")),
                  n: i + 1,
                })}
                icon={<Trash />}
                onClick={() => onChange(points.filter((_, j) => j !== i))}
              />
            )}
          </li>
        ))}
      </ol>
      {ctx.structureLocked ? null : (
        <Button
          variant="secondary"
          size="sm"
          startIcon={<Plus />}
          className="self-start"
          onClick={() => onChange([...points, ["", 0]])}
        >
          {tw("addItem", { item: inline(label("point")) })}
        </Button>
      )}
    </section>
  );
}
