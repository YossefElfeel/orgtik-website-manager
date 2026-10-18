"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, ErrorState, LoadingState, Select, toast } from "@orgtik/ui";
import { Link } from "@/i18n/routing";
import { TYPES } from "@/lib/contentTypes";
import { useCan } from "@/lib/permissions";
import { useEntryQuery, useSaveEntryMutation, type Locale } from "@/store/api";
import { ValueEditor } from "./BlockEditor";

export const SHARED_PAGES: Record<string, { id: string; prefixes: string[] }> =
  {
    pg_faq: { id: "pg_home", prefixes: ["faqs"] },
    pg_plans: {
      id: "gl_commerce",
      prefixes: ["purchasePlans-", "purchaseUI-", "purchaseControls-"],
    },
    pg_cart: {
      id: "gl_commerce",
      prefixes: ["purchaseCart-", "purchaseControls-"],
    },
    pg_checkout: {
      id: "gl_commerce",
      prefixes: ["purchaseCheckout-", "paymentDetails-"],
    },
    pg_signUp: { id: "pg_signIn", prefixes: ["signin"] },
  };

/** Edits the canonical record, so shared screens never diverge into duplicate copy. */
export function SharedCopyPanel({
  pageId,
  lang,
  readOnly,
}: {
  pageId: string;
  lang: Locale;
  readOnly: boolean;
}) {
  const source = SHARED_PAGES[pageId];
  const type = source.id.startsWith("pg_") ? "page" : "global";
  const query = useEntryQuery({ type, id: source.id });
  const [save, saving] = useSaveEntryMutation();
  const [section, setSection] = useState<string | null>(null);
  const [editsByLang, setEditsByLang] = useState<
    Partial<Record<Locale, Record<string, unknown>>>
  >({});
  const edits = editsByLang[lang] ?? {};
  useEffect(() => {
    if (
      !Object.values(editsByLang).some(
        (value) => Object.keys(value ?? {}).length,
      )
    )
      return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editsByLang]);
  const t = useTranslations("Improvements");
  const te = useTranslations("Editor");
  const can = useCan();
  if (query.isLoading) return <LoadingState rows={3} />;
  if (!query.data || query.error) return <ErrorState onRetry={query.refetch} />;
  const entry = query.data;
  const sections = TYPES[type]
    .sections({ ...entry, id: undefined })
    .filter((item) =>
      source.prefixes.some((prefix) => item.value.startsWith(prefix)),
    )
    .sort(
      (a, b) =>
        source.prefixes.findIndex((prefix) => a.value.startsWith(prefix)) -
        source.prefixes.findIndex((prefix) => b.value.startsWith(prefix)),
    );
  const active = sections.find((item) => item.value === section) ?? sections[0];
  const tree = { ...entry.content.locales[lang], ...edits };
  const locked = readOnly || !can("content:edit");
  return (
    <section className="flex flex-col gap-4">
      <p className="text-body-sm text-fg-muted">{t("sharedCopyHint")}</p>
      <Select
        aria-label={t("sharedCopy")}
        value={active?.value}
        onValueChange={setSection}
        options={sections.map((item) => ({
          value: item.value,
          label: item.label ?? item.value,
        }))}
      />
      {active ? (
        <ValueEditor
          node={active.node}
          value={tree[active.path]}
          fallback={entry.content.locales.en?.[active.path]}
          path={active.path}
          onChange={(value) =>
            setEditsByLang((previous) => ({
              ...previous,
              [lang]: { ...previous[lang], [active.path]: value },
            }))
          }
          ctx={{
            lang,
            readOnly: locked,
            structureLocked: locked || lang !== "en",
            numbersLocked: locked || lang !== "en",
            errors: {},
          }}
        />
      ) : null}
      <div className="flex items-center gap-3">
        {!locked ? (
          <Button
            disabled={!Object.keys(edits).length}
            loading={saving.isLoading}
            onClick={async () => {
              try {
                await save({
                  type,
                  id: entry.id,
                  version: entry.version,
                  patch: { locale: lang, fields: edits },
                }).unwrap();
                setEditsByLang((previous) => ({ ...previous, [lang]: {} }));
                toast.success(te("saved"));
              } catch {
                toast.error(te("saveFailed"));
              }
            }}
          >
            {te("save")}
          </Button>
        ) : null}
        <Link
          className="text-body-sm text-fg-brand underline"
          href={`/content/${TYPES[type].area}/${entry.id}?section=${active?.value ?? ""}&lang=${lang}`}
        >
          {t("sharedCopy")}
        </Link>
      </div>
    </section>
  );
}
