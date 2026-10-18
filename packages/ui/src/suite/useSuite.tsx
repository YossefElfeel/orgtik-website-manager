"use client";
import { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { useClientSession, readClientSession } from "../auth/session.js";
import { suiteRequest } from "./api.js";
import { CONNECTOR_PAIRS, SUITE_TOOLS } from "./registry.js";
import type { ConnectionState, SuiteOptions, SuiteProviderProps, SuiteSnapshot, ToolKey } from "./types.js";

const Context = createContext<SuiteOptions & { refresh?: () => Promise<void> }>({});
export function SuiteProvider({ children, ...options }: SuiteProviderProps) {
  const session = useClientSession(), [remote, setRemote] = useState<SuiteSnapshot | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState<string>();
  const apiUrl = options.apiUrl, token = session?.tokens.accessToken, workspaceId = session?.workspaceContext?.workspace.id;
  const refresh = useCallback(async () => {
    if (!apiUrl || !token || !workspaceId || options.snapshot !== undefined) return;
    const current = () => readClientSession()?.tokens.accessToken === token && readClientSession()?.workspaceContext?.workspace.id === workspaceId;
    setLoading(true); setError(undefined);
    try { const value = await suiteRequest<SuiteSnapshot>(apiUrl, "/bootstrap"); if (current()) setRemote(value); }
    catch (failure) { if (current()) setError(failure instanceof Error ? failure.message : "The workspace could not be loaded."); throw failure; }
    finally { if (current()) setLoading(false); }
  }, [apiUrl, token, workspaceId, options.snapshot]);
  useEffect(() => { setRemote(null); if (apiUrl && token && workspaceId && options.snapshot === undefined) void refresh().catch(() => {}); }, [apiUrl, token, workspaceId, options.snapshot, refresh]);
  return <Context.Provider value={{ ...options, snapshot: options.snapshot === undefined ? remote || session?.workspaceContext as SuiteSnapshot | null : options.snapshot, loading: options.loading ?? loading, error: options.error ?? error, refresh }}>{children}</Context.Provider>;
}
const canRead = (access?: string) => Boolean(access && !["no_access", "not_subscribed"].includes(access));
export function connectionState(snapshot: SuiteSnapshot | null, source: ToolKey | undefined, target: ToolKey, write = true, targetWrite = false): ConnectionState {
  const writing = write || targetWrite;
  if (writing && (snapshot?.actor.readOnly || snapshot?.workspace.state === "suspended" || source && snapshot?.tools[source]?.access === "read_only")) return "read_only";
  if (source) {
    const origin = snapshot?.tools[source];
    if (!origin || origin.access === "not_subscribed") return "not_subscribed";
    if (origin.access === "no_access") return origin.reason === "unsupported_tool_role" ? "role_denied" : "no_access";
  }
  const tool = snapshot?.tools[target];
  const configured = snapshot?.connectors?.find(row => row.source === source && row.target === target);
  const projection = configured?.accessMode === "projection";
  if (!tool || tool.access === "not_subscribed") return "not_subscribed";
  if (tool.access === "no_access" && !projection) return tool.reason === "unsupported_tool_role" ? "role_denied" : "no_access";
  if (projection && snapshot?.member.role === "guest") return "role_denied";
  if (writing && tool.access === "read_only") return "read_only";
  if (write && source && !snapshot?.tools[source]?.canWrite) return "role_denied";
  if (targetWrite && !tool.canWrite) return "role_denied";
  if (source && source !== target) {
    if (!CONNECTOR_PAIRS.some(([a,b]) => a === source && b === target || a === target && b === source)) return "disabled";
    const connector = snapshot?.connectors?.find(row => row.source === source && row.target === target) || snapshot?.connectors?.find(row => row.source === target && row.target === source);
    if (connector?.enabled === false) return "disabled";
  }
  return "available";
}
export function useSuite() {
  const options = useContext(Context), session = useClientSession();
  const snapshot = options.snapshot === undefined ? session?.workspaceContext as SuiteSnapshot | null ?? null : options.snapshot;
  return useMemo(() => {
    const toolState = (tool: ToolKey) => snapshot?.tools[tool];
    const hasTool = (tool: ToolKey) => Boolean(toolState(tool) && toolState(tool)?.access !== "not_subscribed");
    const accessibleTools = (Object.keys(SUITE_TOOLS) as ToolKey[]).filter(tool => canRead(toolState(tool)?.access));
    const isOwner = snapshot?.member.role === "owner" && !snapshot.actor.readOnly;
    const canAdmin = (tool: ToolKey) => canRead(toolState(tool)?.access) && Boolean(["owner", "admin"].includes(snapshot?.member.role || "") || toolState(tool)?.roles.some(role => SUITE_TOOLS[tool].adminRoles.includes(role)));
    const request = async <T,>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: unknown) => { if (!options.apiUrl) throw new Error("The suite API is unavailable."); return suiteRequest<T>(options.apiUrl, path, { method, body }); };
    const mutate = async <T,>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => { const result = await request<T>(path, method, body); await options.refresh?.(); return result; };
    return { ...options, snapshot, session, request, mutate, toolState, hasTool, accessibleTools, isOwner, canAdmin, loading: options.loading ?? (!snapshot && !session), seat: (tool: ToolKey) => toolState(tool)?.seats, connectionState: (target: ToolKey, source = options.currentTool, write = true, targetWrite = false) => connectionState(snapshot ?? null, source, target, write, targetWrite), canConnect: (source: ToolKey, target: ToolKey) => connectionState(snapshot ?? null, source, target, false) === "available" };
  }, [options, snapshot, session]);
}
