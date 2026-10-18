// Actual signed-session/HTTP/persistence boundary. All clocks and files belong to this
// disposable subprocess fixture; no shared clock, configured Redis or hosted data is used.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const AT = "2026-10-07T09:00:00.000Z", DAY = 86400000;
const clone = value => JSON.parse(JSON.stringify(value));

async function child(step) {
  const config = require("../config"); config.dataDir = process.env.BILLING_ENDPOINT_DIR;
  const journal = require("./journal"), store = journal.fileStore(path.join(config.dataDir, "journal.json"));
  let refuseCommit = false;
  const commit = store.commit.bind(store);
  store.commit = (...args) => refuseCommit ? Promise.reject(Object.assign(new Error("Isolated persistence failure"), { status: 503, code: "journal_unavailable" })) : commit(...args);
  journal.pickStore = () => ({ sandbox: process.env.MOCK_SANDBOX, store });
  const server = require("node:http").createServer(require("../api/index"));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const platform = { exportState: () => require("../apps/admin").exportState(), importState: value => require("../apps/admin").importState(value), getStore: () => require("../apps/admin").getStore() };
  const factsFile = path.join(config.dataDir, "facts.json");
  async function call(app, route, method = "GET", body, token, headers = {}) {
    const response = await fetch(`${base}/${app}${route}`, { method, headers: { connection: "close", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
    const text = await response.text(), raw = text ? JSON.parse(text) : {};
    return { status: response.status, raw, data: raw.data ?? raw };
  }
  const signed = async (email, mode, target) => { const result = await call("sos", "/api/auth/login", "POST", { email, password: "Local@2026", ...(mode ? { mode, target } : {}) }); assert.equal(result.status, 200, result.raw.message); return result.data.tokens.accessToken; };
  const invoice = id => platform.exportState().db.invoices.find(row => row.id === id);
  const key = value => ({ "idempotency-key": value });
  const currentClock = () => require("./clock").now();
  try {
    if (step === "flow") {
      const owner = await signed("mona.adel@orgtik.test"), staff = await signed("mona.adel@orgtik.test", "staff", "admin"), customer = await signed("nour.khaled@nilefoods.test");
      const now = currentClock(); assert.equal(now, Date.parse(AT));
      assert.ok([401, 403].includes((await call("admin", "/v1/admin/billing/lifecycle", "POST", { workspaceId: "ws_orgtik" }, customer, key("customer-run"))).status));
      assert.equal((await call("sos", "/v1/app/billing/recover", "POST", { lineId: "foreign" }, owner, { ...key("cross-workspace"), "x-workspace": "ws_nile" })).status, 409);
      assert.equal((await call("admin", "/v1/admin/billing/lifecycle", "POST", { workspaceId: "ws_orgtik", at: "2099-01-01T00:00:00Z" }, staff, key("client-clock"))).status, 422);
      const fixture = platform.exportState(), ws = fixture.db.workspaces.find(row => row.id === "ws_orgtik");
      const historical = clone(fixture.db.invoices.filter(row => row.state === "paid"));
      fixture.db.invoices = fixture.db.invoices.filter(row => row.workspaceId !== ws.id || row.state !== "open");
      const original = clone(ws.lines.find(row => row.tool === "tasks" && row.state === "active"));
      const badMethod = ws.paymentMethods.find(row => row.isDefault); badMethod.last4 = "0002";
      const goodMethod = { ...badMethod, id: "pm_http_good", last4: "4242", isDefault: false, expires: "01/40", expired: false }; ws.paymentMethods.push(goodMethod);
      const grace = { ...clone(original), id: "ln_http_grace", periodStart: new Date(now - 37 * DAY + 1).toISOString(), periodEnd: new Date(now - 7 * DAY + 1).toISOString(), autoRenew: true };
      ws.lines.unshift(grace); platform.importState(fixture);
      assert.equal((await call("admin", "/v1/admin/billing/lifecycle", "POST", { workspaceId: ws.id }, staff, key("grace-run"))).status, 200);
      assert.equal(platform.getStore().workspace(ws.id).lines.find(row => row.id === grace.id).state, "past_due");
      const tasks = await call("sos", "/api/auth/workspace", "POST", { workspaceId: ws.id, target: "tasks" }, owner); assert.equal(tasks.status, 200);
      const tasksToken = tasks.data.tokens.accessToken;
      const project = await call("tasks", "/api/projects", "POST", { title: "Writes within the final grace millisecond" }, tasksToken); assert.equal(project.status, 201);
      const exactFixture = platform.exportState(), exactWs = exactFixture.db.workspaces.find(row => row.id === ws.id);
      Object.assign(exactWs.lines.find(row => row.id === grace.id), { state: "ended", endedAt: AT });
      const exact = { ...clone(original), id: "ln_http_exact", periodStart: new Date(now - 37 * DAY).toISOString(), periodEnd: new Date(now - 7 * DAY).toISOString(), autoRenew: true };
      exactWs.lines.unshift(exact); platform.importState(exactFixture);
      assert.equal((await call("admin", "/v1/admin/billing/lifecycle", "POST", { workspaceId: ws.id }, staff, key("exact-run"))).status, 200);
      const boundaryLine = platform.getStore().workspace(ws.id).lines.find(row => row.id === exact.id);
      assert.equal(boundaryLine.state, "read_only"); assert.equal(boundaryLine.readOnlySince, AT);
      const blocked = await call("tasks", "/api/projects", "POST", { title: "Must not be written" }, tasksToken); assert.equal(blocked.status, 423); assert.equal(blocked.data.code, "workspace_read_only");
      assert.equal((await call("tasks", "/api/projects", "GET", undefined, tasksToken)).status, 200);
      const cycle = Object.values(platform.exportState().db.billingLifecycle.cycles).find(row => row.lineId === exact.id), invoiceId = cycle.invoiceId;
      const declineBody = { paymentMethodId: badMethod.id }, retryPath = `/v1/app/subscriptions/${exact.id}/retry`;
      const countBefore = invoice(invoiceId).payments.length;
      assert.equal((await call("sos", retryPath, "POST", declineBody, owner, key("decline-proof"))).status, 402);
      assert.equal(invoice(invoiceId).payments.length, countBefore + 1);
      assert.equal((await call("sos", retryPath, "POST", declineBody, owner, key("decline-proof"))).status, 402);
      assert.equal(invoice(invoiceId).payments.length, countBefore + 1);
      assert.equal((await call("sos", retryPath, "POST", { paymentMethodId: goodMethod.id }, owner, key("decline-proof"))).status, 409);
      fs.writeFileSync(factsFile, JSON.stringify({ owner, staff, tasksToken, workspaceId: ws.id, exactLineId: exact.id, originalQuantity: exact.snapshot.quantity, goodMethodId: goodMethod.id, declineBody, retryPath, invoiceId, declinedCount: countBefore + 1, historical, projectId: project.data.id, at: AT }));
    } else if (step === "cold") {
      const facts = JSON.parse(fs.readFileSync(factsFile, "utf8"));
      assert.equal((await call("sos", "/api/auth/me", "GET", undefined, facts.owner)).status, 200);
      assert.equal(currentClock(), Date.parse(facts.at));
      assert.equal((await call("tasks", "/api/projects", "POST", { title: "Still blocked after cold start" }, facts.tasksToken)).status, 423);
      assert.equal((await call("tasks", `/api/projects/${facts.projectId}`, "GET", undefined, facts.tasksToken)).status, 200);
      assert.equal((await call("sos", facts.retryPath, "POST", facts.declineBody, facts.owner, key("decline-proof"))).status, 402);
      assert.equal(invoice(facts.invoiceId).payments.length, facts.declinedCount);
      const manager = await signed("karim.hassan@orgtik.test");
      assert.equal((await call("sos", facts.retryPath, "POST", facts.declineBody, manager, key("decline-proof"))).status, 403);
      const beforeAuthorityChange = platform.exportState(), revoked = clone(beforeAuthorityChange), revokedWs = revoked.db.workspaces.find(row => row.id === facts.workspaceId);
      revokedWs.members.find(row => row.userKey === "admin").role = "admin"; platform.importState(revoked);
      assert.equal((await call("sos", facts.retryPath, "POST", facts.declineBody, facts.owner, key("decline-proof"))).status, 403);
      platform.importState(beforeAuthorityChange);
      const recoverBody = { lineId: facts.exactLineId, paymentMethodId: facts.goodMethodId };
      const recovered = await call("sos", "/v1/app/billing/recover", "POST", recoverBody, facts.owner, key("recover-proof")); assert.equal(recovered.status, 200); assert.equal(recovered.data.paymentStatus, "succeeded"); assert.equal(recovered.data.invoiceId, facts.invoiceId);
      const paidInvoice = clone(invoice(facts.invoiceId));
      assert.equal((await call("sos", "/v1/app/billing/recover", "POST", recoverBody, facts.owner, key("recover-proof"))).status, 200); assert.deepEqual(invoice(facts.invoiceId), paidInvoice);
      assert.equal((await call("tasks", "/api/projects", "POST", { title: "Recovered workspace writes" }, facts.tasksToken)).status, 201);
      const quoted = await call("sos", "/v1/app/billing/seats/quote", "POST", { lineId: facts.exactLineId, quantity: facts.originalQuantity + 1 }, facts.owner, key("seat-quote")); assert.equal(quoted.status, 200); assert.ok(quoted.data.total > 0);
      const invoiceCount = platform.exportState().db.invoices.length;
      const confirmBody = { quoteId: quoted.data.quoteId, paymentMethodId: facts.goodMethodId };
      assert.equal((await call("sos", "/v1/app/billing/seats/confirm", "POST", { ...confirmBody, total: 0, quantity: 999 }, facts.owner, key("seat-confirm"))).status, 422);
      assert.equal(platform.exportState().db.invoices.length, invoiceCount);
      refuseCommit = true;
      const failedPersistence = await call("sos", "/v1/app/billing/seats/confirm", "POST", confirmBody, facts.owner, key("seat-confirm")); refuseCommit = false; assert.equal(failedPersistence.status, 503);
      assert.equal((await call("sos", "/v1/app/me", "GET", undefined, facts.owner)).status, 200);
      assert.equal(platform.exportState().db.invoices.length, invoiceCount);
      const paid = await call("sos", "/v1/app/billing/seats/confirm", "POST", confirmBody, facts.owner, key("seat-confirm")); assert.equal(paid.status, 200); assert.equal(paid.data.paymentStatus, "succeeded"); assert.equal(paid.data.quantity, facts.originalQuantity + 1); assert.equal(paid.data.total, quoted.data.total);
      const afterPaid = clone(invoice(paid.data.invoiceId));
      assert.equal((await call("sos", "/v1/app/billing/seats/confirm", "POST", confirmBody, facts.owner, key("seat-confirm"))).status, 200); assert.deepEqual(invoice(paid.data.invoiceId), afterPaid);
      assert.equal(platform.exportState().db.invoices.length, invoiceCount + 1);
      for (const historical of facts.historical) assert.deepEqual(invoice(historical.id), historical);
      assert.equal(currentClock(), Date.parse(facts.at));
    } else throw new Error("Unknown isolated endpoint phase");
    console.log(`Isolated billing HTTP phase ${step} passed`);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}

if (process.argv.includes("--billing-child")) {
  child(process.argv[process.argv.indexOf("--billing-child") + 1]).catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
} else {
  const { test } = require("node:test");
  test("HTTP billing commands preserve clock, authority, refusal receipts and read-only state across cold start", { timeout: 120000 }, async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-billing-http-"));
    const env = { ...process.env, BILLING_ENDPOINT_DIR: folder, MOCK_AUTH_STORE: "file", MOCK_AUTH_FILE: path.join(folder, "accounts.json"), MOCK_JOURNAL: "file", MOCK_SANDBOX: `billing-http-${process.pid}`, MOCK_CLOCK: "frozen", MOCK_NOW: AT, MOCK_PUBLIC_URL: "", VERCEL: "", KV_REST_API_URL: "", KV_REST_API_TOKEN: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" };
    const run = phase => new Promise((resolve, reject) => {
      const process = spawn(globalThis.process.execPath, [__filename, "--only=sos,admin,tasks", "--billing-child", phase], { env, stdio: ["ignore", "pipe", "pipe"] });
      let output = ""; process.stdout.on("data", value => output += value); process.stderr.on("data", value => output += value);
      process.on("error", reject); process.on("exit", code => code === 0 ? resolve() : reject(new Error(`Billing ${phase} exited ${code}\n${output.slice(-7000)}`)));
    });
    try { await run("flow"); await run("cold"); }
    finally {
      const resolved = fs.realpathSync(folder), parent = fs.realpathSync(os.tmpdir()) + path.sep;
      assert.ok(resolved.startsWith(parent) && path.basename(resolved).startsWith("orgtik-billing-http-")); fs.rmSync(resolved, { recursive: true, force: true });
    }
  });
}
