"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "@phosphor-icons/react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Select,
  toast,
} from "@orgtik/ui";
import { useRouter } from "@/i18n/routing";
import { TYPES } from "@/lib/contentTypes";
import { DEPARTMENTS, type Department } from "@/lib/caseStudySchema";
import {
  useCreateEntryMutation,
  type ApiError,
  type EntrySummary,
  type EntryType,
} from "@/store/api";

/** The address part a name suggests: "Café design, 2026" → "cafe-design-2026". */
export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/**
 * A schema-shaped blank entry or an explicit template copy. It starts in English and stays
 * private until review and publication; blank case studies require a department.
 */
export function NewEntry({
  type: key,
  entries,
}: {
  type: EntryType;
  entries: EntrySummary[];
}) {
  const t = useTranslations("Editor");
  const tt = useTranslations("Types");
  const fields = useTranslations("Fields");
  const tf = useTranslations("Formats");
  const td = useTranslations("Departments");
  const router = useRouter();
  const type = TYPES[key];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [create, creating] = useCreateEntryMutation();
  const address = slug ?? slugify(name);
  const start = from ?? "blank";

  const submit = () => {
    setErrors({});
    create({
      type: key,
      name,
      slug: type.seo ? address : undefined,
      from: start === "blank" ? undefined : start,
      department:
        start === "blank" && key === "caseStudy"
          ? (department ?? undefined)
          : undefined,
    })
      .unwrap()
      .then((e) => {
        toast.success(t("created"));
        setOpen(false);
        router.push(`/content/${type.area}/${e.id}`);
      })
      .catch((e: ApiError) => {
        if (e.status === 422 && e.fieldErrors)
          setErrors(
            Object.fromEntries(
              Object.entries(e.fieldErrors).map(([k, v]) => [
                k.replace(/^slug\.en$/, "slug"),
                v,
              ]),
            ),
          );
        else toast.error(t("saveFailed"));
      });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (
        setOpen(o),
        o
          ? (setName(""),
            setSlug(null),
            setFrom(null),
            setDepartment(null),
            setErrors({}))
          : null
      )}
    >
      <Button
        size="sm"
        startIcon={<Plus />}
        onClick={() => setOpen(true)}
        className="ms-auto"
      >
        {tt(`${key}.new`)}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tt(`${key}.new`)}</DialogTitle>
          <DialogDescription>{t("newBody")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Field
            label={key === "review" ? fields("reviewAuthor") : t("name")}
            error={errors.name ? t("errorRequired") : undefined}
          >
            <Input
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          {type.seo ? (
            <Field
              label={t("slug")}
              description={t("slugHelp", { path: type.path(address) })}
              error={
                errors.slug
                  ? t(
                      errors.slug === "slug_taken"
                        ? "errorSlugTaken"
                        : errors.slug === "required"
                          ? "errorRequired"
                          : "errorSlug",
                    )
                  : undefined
              }
            >
              <Input
                dir="ltr"
                value={address}
                onChange={(e) => setSlug(e.target.value)}
              />
            </Field>
          ) : null}
          <Field
            label={t("startFrom")}
            description={t("startFromHelp")}
            error={errors.from ? t("errorRequired") : undefined}
          >
            <Select
              value={start}
              onValueChange={(v) => setFrom(v)}
              options={[
                { value: "blank", label: t("startBlank") },
                ...entries.map((x) => ({
                  value: x.id,
                  label: <span dir="auto">{x.name}</span>,
                })),
              ]}
            />
          </Field>
          {key === "caseStudy" && start === "blank" ? (
            <Field
              label={t("department")}
              description={department ? tf(department) : t("departmentHelp")}
              error={errors.department ? t("errorRequired") : undefined}
            >
              <Select
                value={department}
                onValueChange={(v) => setDepartment(v as Department)}
                options={DEPARTMENTS.map((value) => ({
                  value,
                  label: td(value),
                }))}
              />
            </Field>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button loading={creating.isLoading} onClick={submit}>
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
