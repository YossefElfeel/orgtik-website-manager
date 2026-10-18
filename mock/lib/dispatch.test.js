const assert = require("node:assert/strict");
const http = require("node:http");
const { test } = require("node:test");
const { dispatch } = require("./dispatch");

test("loopback keeps binary payloads, cookies and redirects across fresh connections", async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.socket);
    assert.equal(req.headers["x-mock-app"], "files");
    assert.equal(req.headers.connection, "close");
    if (req.url === "/redirect") return res.writeHead(302, { location: "/binary" }).end();
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      res.writeHead(200, { "set-cookie": ["a=1; Path=/", "b=2; Path=/"], "content-type": "application/octet-stream" });
      res.end(Buffer.concat(chunks));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const bytes = Buffer.from([0, 255, 13, 10, 128]);
    for (let n = 0; n < 3; n++) {
      const response = await dispatch(base, "files", { method: "POST", url: "/binary", headers: { connection: "keep-alive" }, body: bytes });
      assert.deepEqual(response.rawPayload, bytes);
      assert.deepEqual(response.headers["set-cookie"], ["a=1; Path=/", "b=2; Path=/"]);
      assert.equal(response.headers.connection, undefined);
    }
    assert.equal(new Set(seen).size, 3);
    const redirect = await dispatch(base, "files", { method: "GET", url: "/redirect" });
    assert.equal(redirect.statusCode, 302);
    assert.equal(redirect.headers.location, "/binary");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  await assert.rejects(dispatch(base, "files", { method: "POST", url: "/binary" }), { code: "ECONNREFUSED" });
});

test('loopback preserves literal route and query targets and refuses remote target overrides', async () => {
  const seen = [];
  const server = http.createServer((req, res) => { seen.push(req.url); res.end(req.url); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const url of ["/api/search?q=O'Brien&tag=a%2fb", '/api/auth/../projects', '/literal#fragment']) {
      const response = await dispatch(base, 'tasks', { method: 'GET', url });
      assert.equal(response.statusCode, 200); assert.equal(response.rawPayload.toString(), url);
    }
    for (const url of ['//outside.test/path', 'https://outside.test/path', '/path\r\nx-extra: invalid']) await assert.rejects(dispatch(base, 'tasks', { method: 'GET', url }), { code: 'INVALID_DISPATCH_TARGET' });
    assert.equal(seen.length, 3);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
