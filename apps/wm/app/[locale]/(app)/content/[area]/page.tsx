"use client";

import { notFound, useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader, Tabs, TabsList } from "@orgtik/ui";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { NewEntry } from "@/components/content/NewEntry";
import { useCan } from "@/lib/permissions";
import { useEntriesQuery } from "@/store/api";
import { EntryList } from "@/components/content/EntryList";
import { usePathname, useRouter } from "@/i18n/routing";
import { AREAS, isArea } from "@/lib/contentTypes";
import type { EntryType } from "@/store/api";

// A content area (Work, Services, Software, Insights). An area with more than one type (Services:
// families and services) shows one tab per type, kept in the address (?type=) so it can be linked.
function AreaPage() {
  const { area } = useParams<{ area: string }>();
  const ta = useTranslations("Areas");
  const tt = useTranslations("Types");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  if (!isArea(area)) notFound();
  const types = AREAS[area];
  const can = useCan();
  const asked = params.get("type") as EntryType | null;
  const current = asked && types.includes(asked) ? asked : types[0];
  const creatable = ["article", "caseStudy", "roadmapItem", "review"].includes(current);
  const templates = useEntriesQuery({type:current,pageSize:100},{skip:!creatable || !can("content:create")});
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={ta(`${area}.title`)} description={ta(`${area}.description`)} actions={creatable && can("content:create") ? <NewEntry type={current} entries={templates.data?.items ?? []} /> : undefined} />
      {types.length > 1 ? (
        <Tabs value={current} onValueChange={(v) => router.replace(`${pathname}?type=${v}`)}>
          <TabsList items={types.map((x) => ({ value: x, label: tt(`${x}.many`) }))} />
        </Tabs>
      ) : null}
      <EntryList key={current} type={current} />
    </div>
  );
}

export default function ContentAreaPage() {
  return (
    <RequirePermission permission="content:view">
      <AreaPage />
    </RequirePermission>
  );
}
