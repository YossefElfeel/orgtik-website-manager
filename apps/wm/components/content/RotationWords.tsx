"use client";
import {useTranslations} from "next-intl";
import {ErrorState, LoadingState} from "@orgtik/ui";
import {Link} from "@/i18n/routing";
import {useEntriesQuery, type EntryType} from "@/store/api";
import {TYPES} from "@/lib/contentTypes";
export function RotationWords({type}:{type:EntryType}) {
  const t=useTranslations("Improvements");
  const query=useEntriesQuery({type,pageSize:100});
  if(query.isLoading)return <LoadingState rows={3}/>;
  if(query.error)return <ErrorState onRetry={query.refetch}/>;
  return <section className="flex flex-col gap-4"><p className="text-body-sm text-fg-muted">{t("rotationSourceHelp")}</p><ul className="flex flex-wrap gap-3">{query.data?.items.filter(entry=>entry.visibility!=="archived").map(entry=><li key={entry.id}><Link className="inline-flex rounded-field border border-line bg-raised px-4 py-3 font-semibold text-fg-brand hover:underline" href={`/content/${TYPES[type].area}/${entry.id}?view=1`}>{entry.name}</Link></li>)}</ul></section>;
}
