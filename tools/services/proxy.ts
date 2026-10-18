// Runtime only. Never import this handler from middleware or a client bundle.
const namespaces = new Set(["sos", "tasks", "files", "hr", "sales", "marketing", "chats", "wm", "admin"]);
const forwarded = ["accept", "accept-language", "authorization", "content-type", "content-length", "range", "if-range", "if-match", "if-none-match", "x-workspace", "idempotency-key", "x-operation-id"];
const responseHeaders = ["content-type", "content-disposition", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];
const failure = (status: number, code: string) => Response.json({ success: false, statusCode: status, code }, { status, headers: { "cache-control": "no-store" } });

export async function proxyBackend(request: Request): Promise<Response> {
  const binding = process.env.ORGTIK_MOCK_URL;
  if (!binding) return failure(503, "service_binding_unavailable");
  const incoming = new URL(request.url);
  const marker = "/api/backend/", position = incoming.pathname.indexOf(marker);
  const path = position < 0 ? "" : incoming.pathname.slice(position + marker.length);
  const namespace = path.split("/")[0] || "";
  if (!namespaces.has(namespace) || /(?:^|\/)__(?:mock|.*)(?:\/|$)|%2f|%5c|%2e|\\/i.test(path)) return failure(404, "not_found");
  const headers = new Headers();
  for (const name of forwarded) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  try {
    // Append to the binding base, rather than discovering a hostname or using a
    // public endpoint. Service bindings do not supply application authorization.
    const base = new URL(binding.endsWith("/") ? binding : `${binding}/`);
    const target = new URL(path + incoming.search, base);
    const init: RequestInit & { duplex?: "half" } = {
      method: request.method, headers, cache: "no-store", redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(55000)]),
    };
    if (!["GET", "HEAD"].includes(request.method)) { init.body = request.body; init.duplex = "half"; }
    const upstream = await fetch(target, init);
    const output = new Headers({ "cache-control": "no-store" });
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value !== null && !(name === "content-length" && upstream.headers.has("content-encoding"))) output.set(name, value);
    }
    const location = upstream.headers.get("location");
    if (location) {
      const resolved = new URL(location, target);
      if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)) return failure(502, "invalid_upstream_redirect");
      output.set("location", incoming.origin + incoming.pathname.slice(0, position + marker.length) + resolved.pathname.slice(base.pathname.length) + resolved.search + resolved.hash);
    }
    return new Response([204, 205, 304].includes(upstream.status) || request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers: output });
  } catch { return failure(503, "backend_unavailable"); }
}
