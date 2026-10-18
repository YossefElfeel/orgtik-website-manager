"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { appPath, appUrl, staffTargetToken, staffToolLaunch, switchWorkspace, TOOL_SCOPES, handoffCode, SessionRequestError, useClientSession } from "@orgtik/ui/auth";
import { Button, ErrorState, NoPermissionState, Spinner } from "@orgtik/ui";
import { CenteredState } from "@/components/frame/CenteredState";
import { SOS_API, SOS_URL } from "@/lib/env";
import { getToken } from "@/lib/session";
export default function StaffGoPage() {
  const { target } = useParams<{ target: string }>(), locale = useLocale(), session = useClientSession();
  const t = useTranslations("Auth"), tn = useTranslations("NoAccess");
  const [error, setError] = useState<SessionRequestError | null>(null), [attempt, setAttempt] = useState(0);
  const pending = useRef<Promise<void> | null>(null);
  useEffect(() => {
    const token = getToken();
    if (token && !session) return;
    const launch = staffToolLaunch(session), tool = launch?.tools.find(tool => tool === target);
    const staff = (target === "admin" || target === "wm") && session?.staffAccess?.apps.includes(target);
    if (!token || (!staff && !tool)) { setError(new SessionRequestError(403, "staff_access_required")); return; }
    setError(null);
    pending.current ??= (async () => {
      if (tool && launch) {
        const workspace = await switchWorkspace(SOS_API, token, launch.workspaceId);
        const code = await handoffCode(SOS_API, workspace.tokens.accessToken, "suite");
        if (getToken() !== token) throw new SessionRequestError(409, "session_changed");
        const destination = appUrl(SOS_URL, "/auth/handoff");
        destination.searchParams.set("code", code);
        destination.searchParams.set("redirect", `/go/${TOOL_SCOPES[tool]}?workspaceId=${encodeURIComponent(launch.workspaceId)}`);
        window.location.assign(destination.toString());
        return;
      }
      if (target !== "admin" && target !== "wm") throw new SessionRequestError(403, "staff_access_required");
      const destinationToken = await staffTargetToken(SOS_API, token, target);
      const code = await handoffCode(SOS_API, destinationToken, target === "admin" ? "staff:admin" : "staff:wm");
      if (getToken() !== token) throw new SessionRequestError(409, "session_changed");
      const origin = target === "admin" ? process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3008" : window.location.origin + appPath("/");
      const destination = appUrl(origin, "/" + locale + "/auth"); destination.searchParams.set("code", code);
      window.location.assign(destination.toString());
    })().catch(reason => { pending.current = null; throw reason; });
    let live = true;
    pending.current.catch(reason => live && setError(reason instanceof SessionRequestError ? reason : new SessionRequestError(503, "session_unavailable")));
    return () => { live = false; };
  }, [target, locale, session, attempt]);
  return <CenteredState>{error ? error.status === 403 ? <NoPermissionState size="compact" title={tn("title")} description={tn("body")} action={<Button onClick={() => window.location.assign(SOS_URL)}>{tn("back")}</Button>} /> : <ErrorState size="compact" title={t("offlineTitle")} description={t("offlineBody")} onRetry={() => { setError(null); setAttempt(value => value + 1); }} /> : <Spinner label={t("checking")} />}</CenteredState>;
}
