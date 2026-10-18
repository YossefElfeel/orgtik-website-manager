import { clearClientSession, readClientSession, setClientSession } from "./session.js";
import { scopesFromContext } from "./access.js";
export class SessionRequestError extends Error {
    status;
    code;
    constructor(status, code, message = "The session request could not be completed.") {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "SessionRequestError";
    }
}
async function request(apiUrl, path, token, body) {
    let response;
    try {
        response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, { method: body === undefined ? "GET" : "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    }
    catch {
        throw new SessionRequestError(503, "session_unavailable");
    }
    let parsed;
    try {
        parsed = await response.json();
    }
    catch {
        throw new SessionRequestError(503, "session_unavailable");
    }
    if (!response.ok)
        throw new SessionRequestError(response.status, parsed.error?.code || parsed.code || "session_error", parsed.message);
    if (parsed.data === undefined)
        throw new SessionRequestError(503, "invalid_session_response");
    return parsed.data;
}
export async function profileFor(apiUrl, tokens) {
    const profile = await request(apiUrl, "/auth/me", tokens.accessToken);
    return { user: profile.user, tokens, scopes: profile.scopes || scopesFromContext(profile.workspaceContext), workspaceContext: profile.workspaceContext ?? null, staffAccess: profile.staffAccess ?? null };
}
export async function exchangeSession(apiUrl, code, audience) {
    const data = await request(apiUrl, "/auth/handoff/exchange", undefined, { code, audience });
    return profileFor(apiUrl, data.tokens);
}
export async function switchWorkspace(apiUrl, token, workspaceId) {
    const data = await request(apiUrl, "/auth/workspace", token, { workspaceId, mode: "workspace" });
    return profileFor(apiUrl, data.tokens);
}
export async function staffTargetToken(apiUrl, token, target) {
    const data = await request(apiUrl, "/auth/workspace", token, { mode: "staff", target });
    return data.tokens.accessToken; // This temporary destination token never replaces the customer tab.
}
export async function handoffCode(apiUrl, token, audience) {
    const data = await request(apiUrl, "/auth/handoff", token, { audience });
    return data.code;
}
const refreshes = new Map();
export async function refreshClientSession(apiUrl) {
    const before = readClientSession();
    if (!before?.tokens.refreshToken)
        throw new SessionRequestError(401, "refresh_missing");
    const key = before.tokens.refreshToken;
    let operation = refreshes.get(key);
    if (!operation) {
        operation = (async () => {
            let data;
            try {
                data = await request(apiUrl, "/auth/refresh", undefined, { refreshToken: key });
            }
            catch (error) {
                if (readClientSession()?.tokens.refreshToken !== key)
                    throw new SessionRequestError(409, "session_changed");
                throw error;
            }
            // A completed request from the previous workspace must never replace the
            // selected context, retry its mutation there, or clear a newer sign-in.
            if (readClientSession()?.tokens.refreshToken !== key)
                throw new SessionRequestError(409, "session_changed");
            const context = data.workspaceContext === undefined ? before.workspaceContext : data.workspaceContext;
            const result = { ...before, tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn }, workspaceContext: context, staffAccess: data.staffAccess === undefined ? before.staffAccess : data.staffAccess, scopes: data.scopes || scopesFromContext(context) };
            setClientSession(result);
            return result;
        })().finally(() => refreshes.delete(key));
        refreshes.set(key, operation);
    }
    return operation;
}
export async function signOutSession(apiUrl, token, all = false) {
    try {
        await request(apiUrl, all ? "/auth/logout-all" : "/auth/logout", token, {});
    }
    catch (error) {
        if (!(error instanceof SessionRequestError) || ![401, 403].includes(error.status))
            throw error;
    }
    clearClientSession(); // Failed503 requests retain valid credentials and permit retry.
}
export { request as sessionRequest };
//# sourceMappingURL=client.js.map