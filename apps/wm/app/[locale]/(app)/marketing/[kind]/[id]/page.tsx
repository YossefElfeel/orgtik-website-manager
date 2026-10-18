"use client";
import { notFound, useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { LeadDetail } from "@/components/marketing/LeadDetail";
import { IdeaDetail } from "@/components/marketing/IdeaDetail";
import { safeReturn } from "@/lib/useListState";
export default function MarketingDetailPage() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const params = useSearchParams();
  const t = useTranslations("Nav");
  if (kind !== "leads" && kind !== "ideas") notFound();
  return (
    <RequirePermission permission="marketing:view">
      <div className="flex flex-col gap-5">
        <Link
          className="self-start text-body-sm text-fg-brand underline"
          href={safeReturn(params.get("returnTo"), `/marketing/${kind}`)}
        >
          {t(kind)}
        </Link>
        {kind === "leads" ? <LeadDetail id={id} /> : <IdeaDetail id={id} />}
      </div>
    </RequirePermission>
  );
}
