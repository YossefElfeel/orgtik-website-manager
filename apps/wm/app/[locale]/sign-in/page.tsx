"use client";
import { sessionRequest, useAuthSuccess, SessionRequestError, type AuthEnvelope } from "@orgtik/ui/auth";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@orgtik/ui";
import { CenteredState } from "@/components/frame/CenteredState";
import { useRouter } from "@/i18n/routing";
import { WM_API, SOS_API } from "@/lib/env";
import { setStaffSession, STAFF_TARGET } from "@/lib/session";

// Standalone sign-in: the suite's SOS login page isn't part of this project, so the Website Manager
// signs in against the mock's identity API itself. The accounts are the mock's WM roles (mock/apps/wm.js).
const ACCOUNTS = [
  { email: "mona.adel@orgtik.test", name: "Mona Adel", role: "wm_super_admin" },
  { email: "karim.hassan@orgtik.test", name: "Karim Hassan", role: "approver" },
  { email: "hoda.ashraf@orgtik.test", name: "Hoda Ashraf", role: "editor" },
  { email: "dina.fathy@orgtik.test", name: "Dina Fathy", role: "marketing" },
  { email: "laila.mostafa@orgtik.test", name: "Laila Mostafa", role: "seo" },
  { email: "salma.nabil@orgtik.test", name: "Salma Nabil", role: "viewer" },
] as const;
const PASSWORD = process.env.NEXT_PUBLIC_LOCAL_PASSWORD ?? "";
type Failure = "forbidden" | "offline" | "rejected";

function SignInForm() {
  const t = useTranslations("SignIn"), router = useRouter();
  const { confirm, success } = useAuthSuccess();
  const params = useSearchParams();
  const landing = useRef((() => { const value = (params.get("redirect") || "").replace(/\s/g, ""); return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/"; })());
  const [busy, setBusy] = useState<string | null>(null), [failure, setFailure] = useState<Failure | null>(null);

  const signIn = async (email: string) => {
    setBusy(email); setFailure(null);
    try {
      const session = await sessionRequest<AuthEnvelope>(SOS_API, "/auth/login", undefined, { email, password: PASSWORD, mode: "staff", target: STAFF_TARGET });
      const me = await fetch(WM_API + "/admin/me", { headers: { Authorization: "Bearer " + session.tokens.accessToken } });
      if (!me.ok) throw new SessionRequestError(me.status, "wm_access");
      setStaffSession(session);
      confirm(() => router.replace(landing.current));
    } catch (reason) {
      const status = reason instanceof SessionRequestError ? reason.status : 503;
      setFailure(status === 403 ? "forbidden" : status >= 500 ? "offline" : "rejected");
      setBusy(null);
    }
  };

  if (success) return success;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-display text-title text-fg">{t("title")}</h1>
        <p className="text-body text-fg-muted">{t("body")}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {ACCOUNTS.map(account => (
          <li key={account.email}>
            <Button variant="secondary" className="w-full" disabled={busy !== null} onClick={() => void signIn(account.email)}>
              <span className="flex w-full items-center justify-between gap-3">
                <span>{account.name}</span>
                <span className="text-caption text-fg-muted">{busy === account.email ? t("signingIn") : account.role}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      {failure && <p role="alert" className="text-center text-body text-danger">{t(failure)}</p>}
    </div>
  );
}

export default function SignInPage() {
  return (
    <CenteredState>
      <Suspense>
        <SignInForm />
      </Suspense>
    </CenteredState>
  );
}
