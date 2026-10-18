import type { AuthEnvelope, SessionPerson, WorkspaceContext } from "./types.js";
export declare function readClientSession<User extends SessionPerson = SessionPerson>(): AuthEnvelope<User> | null;
export declare function setClientSession<User extends SessionPerson>(session: AuthEnvelope<User>): void;
export declare function clearClientSession(): void;
export declare function subscribeClientSession(listener: () => void): () => void;
export declare const getAccessToken: () => string | null;
export declare const getWorkspaceContext: () => WorkspaceContext | null;
export declare function useClientSession<User extends SessionPerson = SessionPerson>(): AuthEnvelope<User> | null;
//# sourceMappingURL=session.d.ts.map