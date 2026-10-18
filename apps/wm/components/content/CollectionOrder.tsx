"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, ErrorState, LoadingState, toast } from "@orgtik/ui";
import { SectionOrder } from "./SectionOrder";
import { useEntriesQuery, useManagerOrderQuery, useSaveManagerOrderMutation, statusOf, type EntryType } from "@/store/api";
import { useEntryName } from "@/lib/entryName";

export function CollectionOrder({type, disabled}: {type:EntryType;disabled:boolean}) {
  const t = useTranslations("Improvements");
  const editor = useTranslations("Editor");
  const name = useEntryName();
  const entries = useEntriesQuery({type,pageSize:100});
  const order = useManagerOrderQuery(type);
  const [save, saving] = useSaveManagerOrderMutation();
  const [pending, setPending] = useState<string[] | null>(null);
  if (entries.isLoading || order.isLoading) return <LoadingState rows={2} />;
  if (entries.error || order.error) return <ErrorState onRetry={()=>{void entries.refetch();void order.refetch();}} />;
  const ids = pending ?? order.data?.ids ?? [];
  const rows = new Map((entries.data?.items ?? []).map(entry=>[entry.id,entry]));
  return <section aria-label={t("orderEntries")} className="flex flex-col gap-3">
    <p className="text-body-sm text-fg-muted">{t("orderHelp")}</p>
    <SectionOrder title={t("orderEntries")} items={ids.map(key=>({key,label:rows.has(key)?name(rows.get(key)!):key}))} disabled={disabled || saving.isLoading} onChange={setPending} />
    {pending ? <div className="flex justify-end gap-2"><Button variant="secondary" disabled={saving.isLoading} onClick={()=>setPending(null)}>{editor("cancel")}</Button><Button loading={saving.isLoading} onClick={async()=>{
      try {await save({type,ids:pending,version:order.data!.version}).unwrap();setPending(null);toast.success(t("orderSaved"));}
      catch(error){toast.error(t(statusOf(error)===412?"orderConflict":"orderFailed"));}
    }}>{t("saveOrder")}</Button></div> : null}
  </section>;
}
