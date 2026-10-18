import { SessionRequestError } from "./client.js";
import type { AuthEnvelope, Audience, SessionPerson } from "./types.js";
/** Retain exchanged tokens while retrying a profile outage; never consume the code twice. */
export declare function useHandoffSession<User extends SessionPerson>(apiUrl: string, audience: Audience, code: string | null): {
    session: AuthEnvelope<User> | null;
    error: SessionRequestError | null;
    loading: boolean;
    retry: () => void;
};
//# sourceMappingURL=use-handoff.d.ts.map