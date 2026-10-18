"use client";

// Where an entry is in its public life (plan: "unpublished / published / archived"): not on the
// site yet, on it, or taken off it. Taking something off keeps it and its history; its address
// redirects to the list it belonged to. Only what never reached the site can be deleted.
import { useTranslations } from "next-intl";
import { ArrowCounterClockwise, EyeSlash, Trash } from "@phosphor-icons/react";
import { Badge, Button, ConfirmDialog, toast } from "@orgtik/ui";
import { useRouter } from "@/i18n/routing";
import { useCan } from "@/lib/permissions";
import { useDeleteEntryMutation, useSetEntryVisibilityMutation, type ApiError, type Entry } from "@/store/api";

const FIXED = new Set(["page", "global", "strings", "pricing"]);

export function VisibilityBadge({ entry }: { entry: Pick<Entry, "visibility"> }) {
  const t = useTranslations("Editor");
  if (entry.visibility === "not_on_site") return <Badge tone="info">{t("notOnSite")}</Badge>;
  if (entry.visibility === "archived") return <Badge tone="neutral">{t("offSite")}</Badge>;
  return null;
}

export function LifecycleActions({ entry, address, listing, area }: { entry: Entry; address: string | null; listing: string | null; area: string }) {
  const t = useTranslations("Editor");
  const can = useCan();
  const router = useRouter();
  const [setVisibility] = useSetEntryVisibilityMutation();
  const [remove] = useDeleteEntryMutation();
  const ref = { type: entry.type, id: entry.id };
  const fail = (e: ApiError) => toast.error(e.status === 403 ? t("needsApprove") : t("saveFailed"));
  if (FIXED.has(entry.type)) return null;

  if (entry.visibility === "not_on_site" && can("content:edit"))
    return (
      <ConfirmDialog
        trigger={<Button variant="ghost" className="text-danger hover:bg-danger-subtle" startIcon={<Trash />}>{t("deleteEntry")}</Button>}
        tone="danger"
        title={t("deleteTitle")}
        impact={t("deleteImpact")}
        confirmLabel={t("deleteEntry")}
        onConfirm={() =>
          remove(ref)
            .unwrap()
            .then(() => (toast.success(t("deleted")), router.replace(`/content/${area}`)))
            .catch(fail)
        }
      />
    );
  if (entry.visibility === "live" && can("content:approve"))
    return (
      <ConfirmDialog
        trigger={<Button variant="ghost" className="text-danger hover:bg-danger-subtle" startIcon={<EyeSlash />}>{t("takeOff")}</Button>}
        tone="danger"
        title={t("takeOffTitle")}
        impact={address && listing ? t("takeOffImpact", { address, listing }) : t("takeOffImpactNoAddress")}
        confirmLabel={t("takeOff")}
        onConfirm={() =>
          setVisibility({ ...ref, version: entry.version, action: "archive" })
            .unwrap()
            .then(() => toast.success(t("takenOff")))
            .catch(fail)
        }
      />
    );
  if (entry.visibility === "archived" && can("content:approve"))
    return (
      <Button
        variant="secondary"
        startIcon={<ArrowCounterClockwise />}
        onClick={() =>
          setVisibility({ ...ref, version: entry.version, action: "unarchive" })
            .unwrap()
            .then(() => toast.success(t("putBackDone")))
            .catch(fail)
        }
      >
        {t("putBack")}
      </Button>
    );
  return null;
}
