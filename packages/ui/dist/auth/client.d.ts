import type { AuthEnvelope, Audience, SessionPerson, SessionTokens } from "./types.js";
export declare class SessionRequestError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message?: string);
}
declare function request<T>(apiUrl: string, path: string, token?: string, body?: unknown): Promise<T>;
export declare function profileFor<User extends SessionPerson>(apiUrl: string, tokens: SessionTokens): Promise<AuthEnvelope<User>>;
export declare function exchangeSession<User extends SessionPerson>(apiUrl: string, code: string, audience: Audience): Promise<AuthEnvelope<User>>;
export declare function switchWorkspace<User extends SessionPerson>(apiUrl: string, token: string, workspaceId: string): Promise<AuthEnvelope<User>>;
export declare function staffTargetToken(apiUrl: string, token: string, target: "admin" | "wm"): Promise<string>;
export declare function handoffCode(apiUrl: string, token: string, audience: Audience): Promise<string>;
export declare function refreshClientSession<User extends SessionPerson>(apiUrl: string): Promise<AuthEnvelope<User>>;
export declare function signOutSession(apiUrl: string, token: string, all?: boolean): Promise<void>;
export { request as sessionRequest };
//# sourceMappingURL=client.d.ts.map