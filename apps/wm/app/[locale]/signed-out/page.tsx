"use client";

import { useTranslations } from "next-intl";
import { Button } from "@orgtik/ui";
import { SignIn } from "@phosphor-icons/react";
import { CenteredState } from "@/components/frame/CenteredState";
import { staffSignInHref } from "@/lib/session";

export default function SignedOutPage() {
  const t = useTranslations("Auth");
  return (
    <CenteredState>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-pill bg-brand-subtle text-fg-brand [&_svg]:size-6">
          <SignIn />
        </span>
        <h1 className="font-display text-title text-fg">{t("signedOutTitle")}</h1>
        <p className="text-body text-fg-muted">{t("signedOutBody")}</p>
        <Button className="mt-2" onClick={() => window.location.assign(staffSignInHref())}>
          {t("signIn")}
        </Button>
      </div>
    </CenteredState>
  );
}
