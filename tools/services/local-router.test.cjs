const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http"), net = require("node:net");
const { createLocalRouter } = require("./local-router.cjs");
const { apps } = require("./config.cjs");
const connections = new WeakMap();
async function listen(server) {
  const sockets = new Set(); connections.set(server, sockets);
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); return server.address().port;
}
async function close(server) { await new Promise(resolve => { server.close(resolve); for (const socket of connections.get(server)) socket.destroy(); }); }

test("local pages preserve app prefixes, queries and redirect locations while concurrent requests start an app once", async () => {
  const starts = [];
  const frontend = http.createServer((req, res) => {
    if (req.url.endsWith("/auth")) { res.writeHead(307, { location: `http://${req.headers.host}/hr/ar` }); res.end(); }
    else res.end(JSON.stringify({ url: req.url, host: req.headers.host, forwardedHost: req.headers["x-forwarded-host"] }));
  });
  const port = await listen(frontend);
  const router = createLocalRouter({ startService: async key => { starts.push(key); await new Promise(resolve => setImmediate(resolve)); return port; }, mock: () => assert.fail("page reached mock") });
  const base = `http://127.0.0.1:${await listen(router)}`;
  try {
    const responses = await Promise.all(["/hr/ar", "/hr/_next/static/chunk.js?x=1", "/hr/ar?_rsc=fixture"].map(path => fetch(base + path)));
    assert.deepEqual(starts, ["hr"]);
    assert.deepEqual(await Promise.all(responses.map(response => response.json().then(body => body.url))), ["/hr/ar", "/hr/_next/static/chunk.js?x=1", "/hr/ar?_rsc=fixture"]);
    const redirected = await fetch(base + "/hr/ar/auth", { redirect: "manual" });
    assert.equal(redirected.headers.get("location"), `${base}/hr/ar`);
    const body = await (await fetch(base + "/" )).json();
    assert.equal(body.host, `localhost:${port}`); assert.equal(body.forwardedHost, new URL(base).host);
    assert.deepEqual(starts, ["hr", "website"]);
    for (const app of apps) await fetch(`${base}/${app}/ar`);
    assert.deepEqual(new Set(starts), new Set([...apps, "website"]));
  } finally { await close(router); await close(frontend); }
});

test("mock gateways bypass frontend startup, preserve mutation headers and body, and block private paths", async () => {
  const router = createLocalRouter({ startService: () => assert.fail("API started a frontend"), mock: async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ url: req.url, version: req.headers["if-match"], token: req.headers.authorization, body }));
  } });
  const base = `http://127.0.0.1:${await listen(router)}`;
  try {
    const response = await fetch(base + "/wm/api/backend/wm/v2/admin/users/1?test=1", { method: "PATCH", headers: { authorization: "Bearer fixture", "if-match": '"version-1"', "content-type": "application/json" }, body: '{"roles":["wm_super_admin"]}' });
    assert.equal(response.headers.get("x-orgtik-local-runtime"), "native");
    assert.deepEqual(await response.json(), { url: "/wm/v2/admin/users/1?test=1", version: '"version-1"', token: "Bearer fixture", body: '{"roles":["wm_super_admin"]}' });
    for (const path of ["/mock/sos/api/auth/login", "/sos/api/backend/nope/api", "/hr/api/backend/hr/__mock/reset", "/sos/api/backend/sos/api%2fauth", "/sos/api/backend/sos/%2e%2e/reset"]) assert.equal((await fetch(base + path)).status, 404, path);
  } finally { await close(router); }
});

test("development websocket upgrades preserve the app prefix and pass bytes in both directions", async () => {
  const frontend = http.createServer();
  frontend.on("upgrade", (req, socket, head) => {
    assert.equal(req.url, "/hr/_next/webpack-hmr");
    socket.write("HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: fixture\r\n\r\n");
    if (head.length) socket.write(head);
    socket.on("data", bytes => socket.write(bytes));
  });
  const frontPort = await listen(frontend);
  const router = createLocalRouter({ startService: async () => frontPort, mock: () => assert.fail("upgrade reached mock") });
  const port = await listen(router);
  let client;
  try {
    await new Promise((resolve, reject) => {
      client = net.connect(port, "127.0.0.1", () => client.write("GET /hr/_next/webpack-hmr HTTP/1.1\r\nHost: localhost:3000\r\nConnection: Upgrade\r\nUpgrade: fixture\r\n\r\n"));
      client.setTimeout(3000, () => reject(new Error("upgrade timed out")));
      let received = "", sent = false;
      client.on("error", reject);
      client.on("data", bytes => { received += bytes; if (received.includes("101 Switching Protocols") && !sent) { sent = true; client.write("hello-hmr"); } if (received.includes("hello-hmr")) resolve(); });
    });
  } finally { client?.destroy(); await close(router); await close(frontend); }
});
