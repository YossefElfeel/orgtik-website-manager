"use client";
import { useEffect, useRef, useState } from "react";
import { profileFor, sessionRequest, SessionRequestError } from "./client.js";
/** Retain exchanged tokens while retrying a profile outage; never consume the code twice. */
export function useHandoffSession(apiUrl, audience, code) {
    const [session, setSession] = useState(null);
    const [error, setError] = useState(null);
    const [attempt, setAttempt] = useState(0);
    const tokens = useRef(null);
    const profile = useRef(null);
    useEffect(() => {
        window.history.replaceState(null, "", window.location.pathname);
        if (!code) {
            setError(new SessionRequestError(400, "handoff_missing"));
            return;
        }
        tokens.current ??= sessionRequest(apiUrl, "/auth/handoff/exchange", undefined, { code, audience }).then(value => value.tokens).catch(reason => { if (reason instanceof SessionRequestError && reason.status >= 500)
            tokens.current = null; throw reason; });
        if (!profile.current || profile.current.attempt !== attempt)
            profile.current = { attempt, value: tokens.current.then(value => profileFor(apiUrl, value)) };
        let live = true;
        setError(null);
        profile.current.value.then(value => live && setSession(value)).catch(reason => live && setError(reason instanceof SessionRequestError ? reason : new SessionRequestError(503, "session_unavailable")));
        return () => { live = false; };
    }, [apiUrl, audience, code, attempt]);
    return { session, error, loading: !session && !error, retry: () => setAttempt(value => value + 1) };
}
//# sourceMappingURL=use-handoff.js.map