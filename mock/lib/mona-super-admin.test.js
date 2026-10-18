const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), http = require("node:http");
test("Mona can launch every suite app with full administration while staff and tenant audiences remain separate", { timeout: 90000 }, async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-mona-access-"));
  Object.assign(process.env, { MOCK_AUTH_STORE: "file", MOCK_AUTH_FILE: path.join(folder, "accounts.json"), MOCK_JOURNAL: "memory", MOCK_SANDBOX: `mona-access-${process.pid}`, MOCK_CLOCK: "frozen", MOCK_NOW: "2026-10-07T09:00:00Z", MOCK_PUBLIC_URL: "", VERCEL: "", VERCEL_ENV: "", ORGTIK_SERVICES: "", ORGTIK_SERVICES_DEV: "", KV_REST_API_URL: "", KV_REST_API_TOKEN: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" });
  require("../config").dataDir = folder;
  const server = http.createServer(require("../api/index"));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (app, endpoint, method = "GET", body, token, extra = {}) => {
    const response = await fetch(`${base}/${app}${endpoint}`, { method, headers: { connection: "close", ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(25000) });
    const value = await response.json();
    return { status: response.status, data: value.data ?? value };
  };
  try {
    const login = await call("sos", "/api/auth/login", "POST", { email: "mona.adel@orgtik.test", password: "Local@2026", mode: "staff", target: "wm" });
    assert.equal(login.status, 200);
    assert.equal(login.data.workspaceContext, null);
    assert.deepEqual(login.data.staffAccess.roles.admin, ["super_admin"]);
    assert.deepEqual(login.data.staffAccess.roles.wm, ["wm_super_admin"]);
    assert.deepEqual(login.data.staffAccess.toolLaunch.tools, ["tasks", "files", "hr", "crm", "marketing", "chat"]);
    let staff = login.data.tokens.accessToken;
    const scopes = await call("sos", "/api/auth/my-scopes", "GET", undefined, staff);
    assert.equal(scopes.status, 200);
    assert.deepEqual(scopes.data.map(scope => scope.name).sort(), ["digital_marketing", "file_manager", "hq", "hr_system", "platform_admin", "sales", "task_manager", "website_manager"].sort());
    assert.ok(scopes.data.filter(scope => scope.mode === "workspace").every(scope => scope.workspaceId === "ws_orgtik"));
    assert.equal((await call("tasks", "/api/projects", "GET", undefined, staff)).status, 401);
    const selected = await call("sos", "/api/auth/workspace", "POST", { mode: "workspace", workspaceId: "ws_orgtik" }, staff);
    assert.equal(selected.status, 200); const suite = selected.data.tokens.accessToken;
    for (const [tool, audience] of Object.entries({ tasks: "tasks", files: "files", hr: "hr", crm: "sales", marketing: "marketing", chat: "chats" })) {
      assert.equal(selected.data.workspaceContext.tools[tool].canWrite, true);
      assert.equal((await call("sos", `/api/suite/tools/${tool}/admin`, "GET", undefined, suite)).status, 200, `${tool} administration`);
      const code = await call("sos", "/api/auth/handoff", "POST", { audience: `tool:${audience}` }, suite);
      assert.equal(code.status, 200);
      const exchanged = await call("sos", "/api/auth/handoff/exchange", "POST", { code: code.data.code, audience: `tool:${audience}` });
      assert.equal(exchanged.status, 200);
      assert.equal(exchanged.data.workspaceContext.workspace.id, "ws_orgtik");
    }
    const admin = await call("sos", "/api/auth/workspace", "POST", { mode: "staff", target: "admin" }, staff);
    assert.equal(admin.status, 200);
    for (const module of require("../apps/admin/permissions").MODULES) assert.ok(admin.data.staffAccess.permissions.admin.includes(`${module}:full`), module);
    assert.ok(login.data.staffAccess.permissions.wm.includes("users:manage"));
    assert.ok(login.data.staffAccess.permissions.wm.includes("roles:manage"));
    // Normal version-checked self-role edits remain authorized by the original
    // snapshot; their successful commit revokes every old staff family.
    for (const role of ["wm_owner", "wm_super_admin"]) {
      const rows = await call("wm", "/v2/admin/users?search=mona.adel", "GET", undefined, staff);
      const mona = rows.data.find(user => user.email === "mona.adel@orgtik.test");
      const updated = await call("wm", `/v2/admin/users/${mona.id}`, "PATCH", { roles: [role] }, staff, { "if-match": mona.version });
      assert.equal(updated.status, 200);
      assert.deepEqual(updated.data.roles, [role]);
      assert.equal((await call("wm", "/v2/admin/me", "GET", undefined, staff)).status, 401);
      staff = (await call("sos", "/api/auth/login", "POST", { email: "mona.adel@orgtik.test", password: "Local@2026", mode: "staff", target: "wm" })).data.tokens.accessToken;
    }
    const viewer = await call("sos", "/api/auth/login", "POST", { email: "salma.nabil@orgtik.test", password: "Local@2026", mode: "staff", target: "wm" });
    assert.equal(viewer.status, 200); assert.equal(viewer.data.staffAccess.toolLaunch, undefined);
    const customer = await call("sos", "/api/auth/register", "POST", { email: "customer@mona-access.fixture.test", name: "Separate Workspace Owner", password: "PrivateFixture!2026" });
    assert.equal(customer.status, 201);
    const denied = await call("sos", "/api/auth/workspace", "POST", { mode: "workspace", workspaceId: customer.data.workspaceContext.workspace.id }, staff);
    assert.equal(denied.status, 403, "super admin does not silently become a customer workspace member");
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    const relative = path.relative(os.tmpdir(), folder);
    assert.ok(relative.startsWith("orgtik-mona-access-") && !relative.includes(path.sep));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
