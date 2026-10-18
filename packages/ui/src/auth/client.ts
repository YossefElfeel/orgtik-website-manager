import { clearClientSession, readClientSession, setClientSession } from "./session.js";
import { scopesFromContext } from "./access.js";
import type { AuthEnvelope, Audience, ScopeGrant, SessionPerson, SessionTokens, StaffAccess, WorkspaceContext } from "./types.js";

export class SessionRequestError extends Error {
  constructor(public status: number, public code: string, message = "The session request could not be completed.") { super(message); this.name = "SessionRequestError"; }
}
type Profile<User extends SessionPerson> = { user: User; scopes?: ScopeGrant[]; workspaceContext: WorkspaceContext | null; staffAccess: StaffAccess | null };
async function request<T>(apiUrl: string, path: string, token?: string, body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, { method: body === undefined ? "GET" : "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw new SessionRequestError(503, "session_unavailable"); }
  let parsed: { data?: T; code?: string; error?: { code?: string }; message?: string };
  try { parsed = await response.json(); } catch { throw new SessionRequestError(503, "session_unavailable"); }
  if (!response.ok) throw new SessionRequestError(response.status, parsed.error?.code || parsed.code || "session_error", parsed.message);
  if (parsed.data === undefined) throw new SessionRequestError(503, "invalid_session_response");
  return parsed.data;
}
export async function profileFor<User extends SessionPerson>(apiUrl: string, tokens: SessionTokens): Promise<AuthEnvelope<User>> {
  const profile = await request<Profile<User>>(apiUrl, "/auth/me", tokens.accessToken);
  return { user: profile.user, tokens, scopes: profile.scopes || scopesFromContext(profile.workspaceContext), workspaceContext: profile.workspaceContext ?? null, staffAccess: profile.staffAccess ?? null };
}
export async function exchangeSession<User extends SessionPerson>(apiUrl: string, code: string, audience: Audience): Promise<AuthEnvelope<User>> {
  const data = await request<{ tokens: SessionTokens }>(apiUrl, "/auth/handoff/exchange", undefined, { code, audience });
  return profileFor<User>(apiUrl, data.tokens);
}
export async function switchWorkspace<User extends SessionPerson>(apiUrl: string, token: string, workspaceId: string): Promise<AuthEnvelope<User>> {
  const data = await request<{ tokens: SessionTokens }>(apiUrl, "/auth/workspace", token, { workspaceId, mode: "workspace" });
  return profileFor<User>(apiUrl, data.tokens);
}
export async function staffTargetToken(apiUrl: string, token: string, target: "admin" | "wm"): Promise<string> {
  const data = await request<{ tokens: SessionTokens }>(apiUrl, "/auth/workspace", token, { mode: "staff", target });
  return data.tokens.accessToken; // This temporary destination token never replaces the customer tab.
}
export async function handoffCode(apiUrl: string, token: string, audience: Audience): Promise<string> {
  const data = await request<{ code: string }>(apiUrl, "/auth/handoff", token, { audience });
  return data.code;
}
const refreshes = new Map<string, Promise<AuthEnvelope>>();
export async function refreshClientSession<User extends SessionPerson>(apiUrl: string): Promise<AuthEnvelope<User>> {
  const before = readClientSession<User>();
  if (!before?.tokens.refreshToken) throw new SessionRequestError(401, "refresh_missing");
  const key = before.tokens.refreshToken;
  let operation = refreshes.get(key);
  if (!operation) {
    operation = (async () => {
      let data: SessionTokens & { workspaceContext?: WorkspaceContext | null; staffAccess?: StaffAccess | null; scopes?: ScopeGrant[] };
      try { data = await request<typeof data>(apiUrl, "/auth/refresh", undefined, { refreshToken: key }); }
      catch (error) {
        if (readClientSession()?.tokens.refreshToken !== key) throw new SessionRequestError(409, "session_changed");
        throw error;
      }
      // A completed request from the previous workspace must never replace the
      // selected context, retry its mutation there, or clear a newer sign-in.
      if (readClientSession()?.tokens.refreshToken !== key) throw new SessionRequestError(409, "session_changed");
      const context = data.workspaceContext === undefined ? before.workspaceContext : data.workspaceContext;
      const result = { ...before, tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn }, workspaceContext: context, staffAccess: data.staffAccess === undefined ? before.staffAccess : data.staffAccess, scopes: data.scopes || scopesFromContext(context) };
      setClientSession(result);
      return result;
    })().finally(() => refreshes.delete(key));
    refreshes.set(key, operation);
  }
  return operation as Promise<AuthEnvelope<User>>;
}
export async function signOutSession(apiUrl: string, token: string, all = false) {
  try { await request<null>(apiUrl, all ? "/auth/logout-all" : "/auth/logout", token, {}); }
  catch (error) { if (!(error instanceof SessionRequestError) || ![401, 403].includes(error.status)) throw error; }
  clearClientSession(); // Failed503 requests retain valid credentials and permit retry.
}
export { request as sessionRequest };
