"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, PencilSimple, Trash } from "@phosphor-icons/react";
import {
  ConfirmDialog,
  MenuSeparator,
  MenuItem,
  MenuLinkItem,
} from "@orgtik/ui";
import { RowActionsMenu } from "./RowActionsMenu";
import { useEntryName } from "@/lib/entryName";
import { Link } from "@/i18n/routing";
import { useCan } from "@/lib/permissions";
import { TYPES } from "@/lib/contentTypes";
import { type EntrySummary, useDeleteEntryMutation } from "@/store/api";

export function EntryActions({
  entry,
  returnTo,
}: {
  entry: EntrySummary;
  returnTo: string;
}) {
  const t = useTranslations("Improvements");
  const can = useCan();
  const name = useEntryName();
  const [deleting, setDeleting] = useState(false);
  const [remove] = useDeleteEntryMutation();
  const href = `/content/${TYPES[entry.type].area}/${entry.id}?returnTo=${encodeURIComponent(returnTo)}`;
  const deletable =
    ["article", "caseStudy", "roadmapItem", "review"].includes(entry.type) &&
    entry.visibility === "not_on_site";
  return (
    <span onClick={(event) => event.stopPropagation()}>
      <RowActionsMenu target={name(entry)}>
        <MenuLinkItem render={<Link href={`${href}&view=1`} />} icon={<Eye />}>
          {t("view")}
        </MenuLinkItem>
        {can("content:edit") ? (
          <MenuLinkItem render={<Link href={href} />} icon={<PencilSimple />}>
            {t("edit")}
          </MenuLinkItem>
        ) : null}
        <MenuSeparator />
        <MenuItem
          icon={<Trash />}
          tone="danger"
          disabled={!can("content:delete") || !deletable}
          title={!deletable ? t("protectedDelete") : undefined}
          onClick={() => setDeleting(true)}
        >
          {t("delete")}
        </MenuItem>
      </RowActionsMenu>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("deleteName", { name: entry.name })}
        impact={t("deleteImpact")}
        confirmLabel={t("delete")}
        irreversible
        onConfirm={() => remove({ type: entry.type, id: entry.id }).unwrap()}
      />
    </span>
  );
}
