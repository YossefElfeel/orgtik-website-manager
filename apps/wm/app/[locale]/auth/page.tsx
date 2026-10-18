"use client";
import { useAuthSuccess, useHandoffSession, SessionRequestError } from "@orgtik/ui/auth";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, ErrorState, NoPermissionState, Spinner } from "@orgtik/ui";
import { CenteredState } from "@/components/frame/CenteredState";
import { useRouter } from "@/i18n/routing";
import { WM_API, SOS_API, SOS_URL } from "@/lib/env";
import { getToken, setStaffSession } from "@/lib/session";
type Result = "checking" | "expired" | "forbidden" | "offline";
function Handoff() {
  const t = useTranslations("Auth"), tn = useTranslations("NoAccess"), router = useRouter();
  const { confirm, success } = useAuthSuccess();
  const params = useSearchParams();
  const code = useRef(params.get("code"));
  const rejectedTokenUrl = useRef(params.has("token"));
  const landing = useRef((() => { const value = (params.get("redirect") || "").replace(/\s/g, ""); return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/"; })());
  const { session, error, retry } = useHandoffSession(SOS_API, "staff:wm", code.current);
  const [result, setResult] = useState<Result>("checking"), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!code.current) { if (!rejectedTokenUrl.current && getToken()) router.replace("/"); else if (!rejectedTokenUrl.current) router.replace("/signed-out"); else setResult("expired"); return; }
    if (error) { setResult(error.status >= 500 ? "offline" : error.status === 403 ? "forbidden" : "expired"); return; }
    if (!session) return;
    if (session.workspaceContext || !session.staffAccess?.apps.includes("wm")) { setResult("forbidden"); return; }
    let live = true;
    fetch(WM_API + "/admin/me", { headers: { Authorization: "Bearer " + session.tokens.accessToken } })
      .then(response => { if (!live) return; if (response.ok) { setStaffSession(session); confirm(() => router.replace(landing.current)); } else setResult(response.status >= 500 ? "offline" : response.status === 403 ? "forbidden" : "expired"); })
      .catch(reason => { if (live) setResult(reason instanceof SessionRequestError && reason.status === 403 ? "forbidden" : "offline"); });
    return () => { live = false; };
  }, [session, error, attempt, router, confirm]);
  const retryAttempt = () => { setResult("checking"); retry(); setAttempt(value => value + 1); };
  if (success) return success;
  if (result === "checking") {
    return (
      <div className="flex justify-center py-6">
        <Spinner label={t("checking")} />
      </div>
    );
  }
  if (result === "forbidden") return <NoPermissionState size="compact" title={tn("title")} description={tn("body")} action={<Button variant="secondary" onClick={() => window.location.assign(SOS_URL)}>{tn("back")}</Button>} />;
  if (result === "offline") return <ErrorState size="compact" title={t("offlineTitle")} description={t("offlineBody")} onRetry={retryAttempt} />;
  return (
    <ErrorState
      size="compact"
      title={t("expiredTitle")}
      description={t("expiredBody")}
      action={<Button onClick={() => window.location.assign(SOS_URL)}>{t("toOrgtik")}</Button>}
    />
  );
}

export default function AuthPage() {
  return (
    <CenteredState>
      <Suspense>
        <Handoff />
      </Suspense>
    </CenteredState>
  );
}
