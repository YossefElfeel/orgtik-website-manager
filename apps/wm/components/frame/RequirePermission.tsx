"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { NoPermissionState } from "@orgtik/ui";
import { useCan } from "@/lib/permissions";

/**
 * A page's own gate, on top of the navigation hiding it: someone who follows a link to a page
 * their role can't open is told which permission it needs, not shown a broken screen.
 */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const t = useTranslations("NoAccess");
  const can = useCan();
  if (!can(permission)) return <NoPermissionState title={t("actionTitle")} description={t("actionBody", { permission })} />;
  return <>{children}</>;
}
