"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { useClientSession, readClientSession } from "../auth/session.js";
import { suiteRequest } from "./api.js";
import { CONNECTOR_PAIRS, SUITE_TOOLS } from "./registry.js";
const Context = createContext({});
export function SuiteProvider({ children, ...options }) {
    const session = useClientSession(), [remote, setRemote] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState();
    const apiUrl = options.apiUrl, token = session?.tokens.accessToken, workspaceId = session?.workspaceContext?.workspace.id;
    const refresh = useCallback(async () => {
        if (!apiUrl || !token || !workspaceId || options.snapshot !== undefined)
            return;
        const current = () => readClientSession()?.tokens.accessToken === token && readClientSession()?.workspaceContext?.workspace.id === workspaceId;
        setLoading(true);
        setError(undefined);
        try {
            const value = await suiteRequest(apiUrl, "/bootstrap");
            if (current())
                setRemote(value);
        }
        catch (failure) {
            if (current())
                setError(failure instanceof Error ? failure.message : "The workspace could not be loaded.");
            throw failure;
        }
        finally {
            if (current())
                setLoading(false);
        }
    }, [apiUrl, token, workspaceId, options.snapshot]);
    useEffect(() => { setRemote(null); if (apiUrl && token && workspaceId && options.snapshot === undefined)
        void refresh().catch(() => { }); }, [apiUrl, token, workspaceId, options.snapshot, refresh]);
    return _jsx(Context.Provider, { value: { ...options, snapshot: options.snapshot === undefined ? remote || session?.workspaceContext : options.snapshot, loading: options.loading ?? loading, error: options.error ?? error, refresh }, children: children });
}
const canRead = (access) => Boolean(access && !["no_access", "not_subscribed"].includes(access));
export function connectionState(snapshot, source, target, write = true, targetWrite = false) {
    const writing = write || targetWrite;
    if (writing && (snapshot?.actor.readOnly || snapshot?.workspace.state === "suspended" || source && snapshot?.tools[source]?.access === "read_only"))
        return "read_only";
    if (source) {
        const origin = snapshot?.tools[source];
        if (!origin || origin.access === "not_subscribed")
            return "not_subscribed";
        if (origin.access === "no_access")
            return origin.reason === "unsupported_tool_role" ? "role_denied" : "no_access";
    }
    const tool = snapshot?.tools[target];
    const configured = snapshot?.connectors?.find(row => row.source === source && row.target === target);
    const projection = configured?.accessMode === "projection";
    if (!tool || tool.access === "not_subscribed")
        return "not_subscribed";
    if (tool.access === "no_access" && !projection)
        return tool.reason === "unsupported_tool_role" ? "role_denied" : "no_access";
    if (projection && snapshot?.member.role === "guest")
        return "role_denied";
    if (writing && tool.access === "read_only")
        return "read_only";
    if (write && source && !snapshot?.tools[source]?.canWrite)
        return "role_denied";
    if (targetWrite && !tool.canWrite)
        return "role_denied";
    if (source && source !== target) {
        if (!CONNECTOR_PAIRS.some(([a, b]) => a === source && b === target || a === target && b === source))
            return "disabled";
        const connector = snapshot?.connectors?.find(row => row.source === source && row.target === target) || snapshot?.connectors?.find(row => row.source === target && row.target === source);
        if (connector?.enabled === false)
            return "disabled";
    }
    return "available";
}
export function useSuite() {
    const options = useContext(Context), session = useClientSession();
    const snapshot = options.snapshot === undefined ? session?.workspaceContext ?? null : options.snapshot;
    return useMemo(() => {
        const toolState = (tool) => snapshot?.tools[tool];
        const hasTool = (tool) => Boolean(toolState(tool) && toolState(tool)?.access !== "not_subscribed");
        const accessibleTools = Object.keys(SUITE_TOOLS).filter(tool => canRead(toolState(tool)?.access));
        const isOwner = snapshot?.member.role === "owner" && !snapshot.actor.readOnly;
        const canAdmin = (tool) => canRead(toolState(tool)?.access) && Boolean(["owner", "admin"].includes(snapshot?.member.role || "") || toolState(tool)?.roles.some(role => SUITE_TOOLS[tool].adminRoles.includes(role)));
        const request = async (path, method = "GET", body) => { if (!options.apiUrl)
            throw new Error("The suite API is unavailable."); return suiteRequest(options.apiUrl, path, { method, body }); };
        const mutate = async (path, method, body) => { const result = await request(path, method, body); await options.refresh?.(); return result; };
        return { ...options, snapshot, session, request, mutate, toolState, hasTool, accessibleTools, isOwner, canAdmin, loading: options.loading ?? (!snapshot && !session), seat: (tool) => toolState(tool)?.seats, connectionState: (target, source = options.currentTool, write = true, targetWrite = false) => connectionState(snapshot ?? null, source, target, write, targetWrite), canConnect: (source, target) => connectionState(snapshot ?? null, source, target, false) === "available" };
    }, [options, snapshot, session]);
}
//# sourceMappingURL=useSuite.js.map