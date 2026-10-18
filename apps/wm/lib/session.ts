"use client";
import { clearClientSession, readClientSession, setClientSession, signOutSession, SessionRequestError, type AuthEnvelope } from "@orgtik/ui/auth";
import { routing } from "@/i18n/routing";
import { SOS_API } from "./env";
export const STAFF_TARGET = "wm" as const;
export function getToken(): string | null {
  const session = readClientSession();
  return session && !session.workspaceContext && session.staffAccess?.apps.includes(STAFF_TARGET) ? session.tokens.accessToken : null;
}
export function setStaffSession(session: AuthEnvelope) {
  if (session.workspaceContext || !session.staffAccess?.apps.includes(STAFF_TARGET)) throw new SessionRequestError(403, "staff_access_required");
  setClientSession(session);
}
export function clearToken() {
  clearClientSession();
  if (typeof document !== "undefined") document.cookie = "wm.token=; path=/; max-age=0; SameSite=Lax";
}
export async function signOutStaff() {
  const token = getToken();
  if (token) await signOutSession(SOS_API, token);
  clearToken();
}
// The standalone sign-in page (app/[locale]/sign-in), in the language the person is using.
export const staffSignInHref = () => {
  const first = typeof window === "undefined" ? "" : window.location.pathname.split("/")[1];
  return `/${(routing.locales as readonly string[]).includes(first) ? first : routing.defaultLocale}/sign-in`;
};
