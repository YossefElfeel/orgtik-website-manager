"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Field,
  Select,
  toast,
} from "@orgtik/ui";
import { useCan } from "@/lib/permissions";
import { useSiteQuery, useUpdateSiteMutation } from "@/store/api";

const names = {
  en: "English",
  ar: "العربية",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
};
export function EnableLanguage() {
  const t = useTranslations("Improvements");
  const ts = useTranslations("Site");
  const can = useCan();
  const allowed = can("locales:enable") && can("settings:edit");
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const { data } = useSiteQuery(undefined, { skip: !allowed });
  const [save, saving] = useUpdateSiteMutation();
  const candidates = { ...names, es: "Español", pt: "Português", nl: "Nederlands" };
  const options = Object.entries(candidates).filter(([code])=>!data?.locales.some(locale=>locale.code===code && locale.enabled)).map(([value,label])=>({value,label}));
  return (
    <>
      <Button
        disabled={!allowed}
        title={!allowed ? ts("needsLocales") : undefined}
        onClick={() => setOpen(true)}
      >
        {t("addLanguage")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("addLanguage")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="mb-4 text-body-sm text-fg-muted">
              {t(options.length ? "enableLanguageHelp" : "allLanguagesEnabled")}
            </p>
            <p className="mb-4 text-body-sm text-fg-muted">{t("languageFlow")}</p>
            {options.length ? (
              <Field label={ts("languages")}>
                <Select
                  value={code}
                  onValueChange={setCode}
                  options={options}
                />
              </Field>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              disabled={!code || !data}
              loading={saving.isLoading}
              onClick={async () => {
                if (!data || !code) return;
                try {
                  await save({
                    version: data.version,
                    patch: {
                      locales: data.locales.some(locale=>locale.code===code) ? data.locales.map(locale=>locale.code===code ? {...locale,enabled:true} : locale) : [...data.locales,{code:code as typeof data.locales[number]["code"],enabled:true,public:false}],
                    },
                  }).unwrap();
                  toast.success(ts("saved"));
                  setOpen(false);
                  setCode(null);
                } catch {
                  toast.error(ts("failed"));
                }
              }}
            >
              {t("addLanguage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
