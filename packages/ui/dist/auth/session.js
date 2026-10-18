"use client";
import { useSyncExternalStore } from "react";
// Apps on one origin still keep independent tab sessions (especially staff vs
// customer contexts). A one-time handoff remains the only transfer mechanism.
const KEY = "orgtik.tab-session.v1" + (process.env.NEXT_PUBLIC_BASE_PATH || ""), EVENT = "orgtik:session-changed";
let snapshot = null, seen;
export function readClientSession() {
    if (typeof window === "undefined")
        return null;
    try {
        const raw = window.sessionStorage.getItem(KEY);
        if (raw !== seen) {
            seen = raw;
            snapshot = raw ? JSON.parse(raw) : null;
        }
    }
    catch { /* A private window retains this tab's in-memory session until reload. */ }
    return snapshot;
}
export function setClientSession(session) {
    // Redux callers can supply live Immer drafts. A tab snapshot must remain usable
    // after the reducer revokes those proxies and after callers mutate their inputs.
    seen = JSON.stringify(session);
    snapshot = JSON.parse(seen);
    if (typeof window !== "undefined") {
        try {
            window.sessionStorage.setItem(KEY, seen);
        }
        catch { }
        window.dispatchEvent(new Event(EVENT));
    }
}
export function clearClientSession() {
    snapshot = null;
    seen = null;
    if (typeof window !== "undefined") {
        try {
            window.sessionStorage.removeItem(KEY);
        }
        catch { }
        window.dispatchEvent(new Event(EVENT));
    }
}
export function subscribeClientSession(listener) {
    if (typeof window === "undefined")
        return () => { };
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
}
export const getAccessToken = () => readClientSession()?.tokens.accessToken || null;
export const getWorkspaceContext = () => readClientSession()?.workspaceContext || null;
export function useClientSession() {
    return useSyncExternalStore(subscribeClientSession, () => readClientSession(), () => null);
}
//# sourceMappingURL=session.js.map