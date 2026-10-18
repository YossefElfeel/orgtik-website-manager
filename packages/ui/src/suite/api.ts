import { readClientSession } from "../auth/session.js";
export class SuiteRequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = "SuiteRequestError"; }
}
export const suiteApiRoot = (base: string) => `${base.replace(/\/+$/, "").replace(/\/api$/, "")}/api/suite`;
export async function suiteRequest<T>(base: string, path: string, options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal; keepalive?: boolean } = {}): Promise<T> {
  const session = readClientSession();
  if (!session) throw new SuiteRequestError(401, "sign_in_required", "Sign in to continue.");
  const response = await fetch(suiteApiRoot(base) + path, { method: options.method || "GET", signal: options.signal, keepalive: options.keepalive, headers: { Authorization: `Bearer ${session.tokens.accessToken}`, "X-Workspace": session.workspaceContext?.workspace.id || "", ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) }, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
  const result = await response.json() as { data?: T; error?: { code?: string; message?: string }; code?: string; message?: string };
  if (!response.ok) throw new SuiteRequestError(response.status, result.error?.code || result.code || "request_failed", result.error?.message || result.message || "The request failed. Try again.");
  return result.data as T;
}
