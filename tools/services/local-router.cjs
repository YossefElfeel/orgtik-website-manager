const http = require("node:http");
const { apps } = require("./config.cjs");
const namespaces = new Set(apps);

function route(url) {
  const pathname = url.split("?")[0];
  if (/^\/mock(?:\/|$)/.test(pathname)) return { denied: true };
  const key = pathname.split("/")[1];
  const marker = `/${key}/api/backend/`;
  if (namespaces.has(key) && pathname.startsWith(marker)) {
    const target = url.slice(marker.length);
    if (!namespaces.has(target.split(/[/?]/)[0]) || /(?:^|\/)__|%2f|%5c|%2e|\\/i.test(target)) return { denied: true };
    return { api: `/${target}` };
  }
  return { service: namespaces.has(key) ? key : "website" };
}

function failure(res, status, code) {
  if (res.headersSent) return res.destroy();
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify({ success: false, code }));
}

function headers(req, port) {
  // Next's locale rewrites must see its own private origin as internal. Keep
  // the browser origin separately, and translate any private redirects below.
  return { ...req.headers, host: `localhost:${port}`, "x-forwarded-host": req.headers.host, "x-forwarded-proto": "http", "x-forwarded-port": req.headers.host?.split(":").at(-1) };
}

function createLocalRouter({ startService, mock }) {
  const starting = new Map();
  function service(key) {
    // Concurrent page, asset and prefetch requests share one startup.
    if (!starting.has(key)) starting.set(key, Promise.resolve().then(() => startService(key)).catch(error => { starting.delete(key); throw error; }));
    return starting.get(key);
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("x-orgtik-local-runtime", "native");
    const target = route(req.url || "/");
    if (target.denied) return failure(res, 404, "not_found");
    if (target.api) {
      req.url = target.api;
      try { await mock(req, res); } catch { failure(res, 503, "backend_unavailable"); }
      return;
    }
    try {
      const port = await service(target.service);
      if (res.destroyed) return;
      const upstream = http.request({ hostname: "localhost", port, path: req.url, method: req.method, headers: headers(req, port) }, incoming => {
        const output = { ...incoming.headers, "x-orgtik-local-runtime": "native" };
        if (output.location) {
          const location = new URL(output.location, `http://127.0.0.1:${port}`);
          if (location.port === String(port) && ["127.0.0.1", "localhost"].includes(location.hostname)) output.location = `http://${req.headers.host}${location.pathname}${location.search}${location.hash}`;
        }
        res.writeHead(incoming.statusCode, output);
        incoming.pipe(res);
      });
      upstream.on("error", () => failure(res, 503, "frontend_unavailable"));
      req.on("aborted", () => upstream.destroy());
      res.on("close", () => { if (!res.writableEnded) upstream.destroy(); });
      req.pipe(upstream);
    } catch { failure(res, 503, "frontend_start_failed"); }
  });
  server.on("upgrade", async (req, socket, head) => {
    const target = route(req.url || "/");
    if (!target.service) return socket.destroy();
    try {
      const port = await service(target.service);
      if (socket.destroyed) return;
      const upstream = http.request({ hostname: "localhost", port, path: req.url, headers: headers(req, port) });
      upstream.on("error", () => socket.destroy());
      upstream.on("response", () => socket.destroy());
      upstream.on("upgrade", (response, peer, buffered) => {
        socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${response.rawHeaders.reduce((out, value, i, list) => i % 2 ? out : `${out}${value}: ${list[i + 1]}\r\n`, "")}\r\n`);
        if (head.length) peer.write(head);
        if (buffered.length) socket.write(buffered);
        peer.on("error", () => socket.destroy());
        socket.on("error", () => peer.destroy());
        socket.on("close", () => peer.destroy());
        peer.on("close", () => socket.destroy());
        socket.on("end", () => peer.destroy());
        peer.on("end", () => socket.destroy());
        socket.pipe(peer).pipe(socket);
      });
      upstream.end();
    } catch { socket.destroy(); }
  });
  return server;
}

module.exports = { createLocalRouter, route };
