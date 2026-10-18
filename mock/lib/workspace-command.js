// Server-side operation fingerprints bind retries to the same workspace, actor and request.
// These are journal metadata, never authority supplied by an HTTP client or a replay header.
const crypto = require("node:crypto");

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function makeWorkspaceOperation({ id, workspaceId, actor, method, path, body = null, result }) {
  if (typeof method !== "string" || !/^(POST|PUT|PATCH|DELETE)$/i.test(method) || typeof path !== "string" || !path.startsWith("/")) throw new TypeError("A workspace operation needs its mutation method and path");
  const cleanActor = { userId: actor?.userId, ...(actor?.impersonatedBy !== undefined ? { impersonatedBy: actor.impersonatedBy } : {}) };
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(canonical({ workspaceId, actor: cleanActor, method: method.toUpperCase(), path, body }))).digest("hex");
  return { id, workspaceId, actor: cleanActor, fingerprint, ...(result !== undefined ? { result } : {}) };
}

module.exports = { makeWorkspaceOperation };
