// Use a fresh loopback connection for each pinned mock request. A pooled fetch connection
// can race server shutdown/idle timeouts while the global mock clock changes during replay.
const http = require("node:http");

const HOP = new Set(["host", "connection", "content-length", "transfer-encoding", "keep-alive", "expect", "upgrade", "x-mock-app"]);

function dispatch(base, key, { method, url, headers, body }) {
  const origin = new URL(base);
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || /[\r\n]/.test(url)) return Promise.reject(Object.assign(new Error('Invalid loopback request target'), { code: 'INVALID_DISPATCH_TARGET' }));
  const h = { "x-mock-app": key, connection: "close" };
  for (const [name, value] of Object.entries(headers || {})) {
    if (!HOP.has(name.toLowerCase()) && value != null) h[name] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  if (body?.length) h["content-length"] = String(body.length);
  return new Promise((resolve, reject) => {
    // Preserve the original HTTP target. URL resolution changes quotes, fragments and dot
    // segments, breaking the capability binding and potentially changing the selected route.
    const request = http.request({ protocol: origin.protocol, hostname: origin.hostname.replace(/^\[|\]$/g, ''), port: origin.port, path: url, method, headers: h, agent: false, maxHeaderSize: 64 * 1024 }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", () => resolve({
        statusCode: response.statusCode,
        headers: Object.fromEntries(Object.entries(response.headers).filter(([name]) => !HOP.has(name) || name === 'content-length')),
        rawPayload: Buffer.concat(chunks),
      }));
    });
    request.on("error", reject);
    request.end(body?.length ? body : undefined);
  });
}

module.exports = { dispatch };
