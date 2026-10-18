// Isolated subprocess endpoint regressions: local account/journal files only. Never Redis,
// production resets, hosted clocks, provider credentials or user business data.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { performance } = require("node:perf_hooks");

const AT = Date.parse("2026-10-07T09:00:00Z"), EMAIL = "financial.owner@fixture.test", PASSWORD = "FinancialFixture@2026";
const clone = value => JSON.parse(JSON.stringify(value));
const groups = () => [{ id: "financial-fixture", kind: "software", lines: [{ catalogId: "files", months: 3, autoRenew: false }, { catalogId: "website", months: 3, autoRenew: false }] }];
const save = data => fs.writeFileSync(process.env.PLATFORM_ENDPOINT_FACTS, JSON.stringify(data));
const load = () => JSON.parse(fs.readFileSync(process.env.PLATFORM_ENDPOINT_FACTS, "utf8"));
const unavailable = () => Object.assign(new Error("Synthetic isolated journal commit outage"), { status: 503 });
async function waitFor(predicate, label, timeout = 15000) {
  const deadline = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

async function child(step) {
  const journal = require("./journal");
  const fixtureStore = journal.fileStore(process.env.PLATFORM_ENDPOINT_JOURNAL);
  const commit = fixtureStore.commit.bind(fixtureStore);
  let rejectCommit = false, raced = false, commits = 0;
  fixtureStore.commit = async (entry, expected) => {
    commits++;
    if (rejectCommit) throw unavailable();
    if ((step === "race" && entry.method === "PATCH" && entry.url === "/v1/app/workspace" || step === 'invite-race' && entry.method === 'POST' && entry.url === '/v1/app/invitations') && !raced) {
      raced = true;
      fs.writeFileSync(path.join(process.env.PLATFORM_ENDPOINT_RACE_DIR, `ready-${process.env.PLATFORM_ENDPOINT_RACE_NAME}.json`), JSON.stringify({ epoch: expected.expectedEpoch, revision: expected.expectedRevision }));
      await waitFor(() => fs.existsSync(path.join(process.env.PLATFORM_ENDPOINT_RACE_DIR, "release")), "both endpoint mutations reaching CAS");
    }
    return commit(entry, expected);
  };
  journal.pickStore = () => ({ sandbox: "isolated-platform-endpoint-fixture", store: fixtureStore });
  const handler = require("../api/index.js"), http = require("node:http");
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, endpoint, body, token, headers = {}) => {
    const response = await fetch(base + endpoint, { method, headers: { "content-type": "application/json", connection: "close", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    return { status: response.status, body: await response.json() };
  };
  const signIn = (email = "mona.adel@orgtik.test", password = "Local@2026") => call("POST", "/sos/api/auth/login", { email, password });
  const staffToken = async token => {
    const selected = await call('POST', '/sos/api/auth/workspace', { mode: 'staff', target: 'admin' }, token);
    assert.equal(selected.status, 200); return selected.body.data.tokens.accessToken;
  };
  const platform = () => require("../apps/admin").exportState();
  const register = async () => {
    const response = await call("POST", "/sos/api/auth/register", { email: EMAIL, password: PASSWORD, name: "Financial Fixture Owner", company: "Original financial fixture" });
    assert.equal(response.status, 201);
    return response.body.data;
  };
  const quote = async (token, workspaceId) => {
    const response = await call("POST", "/admin/v1/public/website-quotes", { groups: groups() }, token, workspaceId ? { "x-workspace": workspaceId } : {});
    assert.equal(response.status, 200); return response.body.data;
  };
  const paymentBody = (quoted, reference) => ({ quoteId: quoted.quoteId, reference, paymentMethod: "card", billing: { name: "Financial Fixture Owner", email: EMAIL } });
  const link = (order, token, workspaceId) => call("POST", "/sos/v1/app/website-orders", { reference: order.reference, claimToken: order.claimToken }, token, { "x-workspace": workspaceId });
  try {
    if (step === "purchase") {
      const account = await register(), token = account.tokens.accessToken;
      const me = await call("GET", "/sos/v1/app/me", null, token); assert.equal(me.status, 200);
      const workspaceId = me.body.data.workspace.id, quoted = await quote(token, workspaceId);
      const request = paymentBody(quoted, "durable-modern-payment");
      const paid = await call("POST", "/admin/v1/public/website-orders", request, token, { "x-workspace": workspaceId });
      assert.equal(paid.status, 200); assert.equal(paid.body.data.paymentStatus, "succeeded");
      const linked = await link(paid.body.data, token, workspaceId); assert.equal(linked.status, 201);
      const state = platform(), invoice = state.db.invoices.find(row => row.reference === paid.body.data.reference);
      assert.ok(invoice && invoice.state === "paid");
      const snapshot = await fixtureStore.snapshot();
      const records = snapshot.entries.map(JSON.parse).map(entry => entry.checkpoint ? { ...entry, ...require('./domain-checkpoint').decodeDomainCheckpoint(entry.checkpoint) } : entry), saved = records.filter(entry => entry.platformState?.db.invoices.some(row => row.id === invoice.id));
      assert.ok(saved.length > 0, "The endpoint persisted a financial domain snapshot");
      assert.ok(saved.every(entry => entry.platformState.platformVersion === 2 && !entry.headers.authorization && !entry.headers.cookie && !entry.headers["x-mock-replay"]));
      save({ accountId: account.user.id, tokens: account.tokens, workspaceId, order: paid.body.data, request, invoice, sequence: state.sequence });
    } else if (step === "cold-repeat") {
      const original = load();
      const refreshed = await call("POST", "/sos/api/auth/refresh", { refreshToken: original.tokens.refreshToken }); assert.equal(refreshed.status, 200);
      const token = refreshed.body.data.accessToken;
      assert.ok(token);
      const detail = await call("GET", `/sos/v1/app/invoices/${original.invoice.id}`, null, token, { "x-workspace": original.workspaceId }); assert.equal(detail.status, 200);
      assert.deepEqual(platform().db.invoices.find(row => row.id === original.invoice.id), original.invoice);
      const paidAgain = await call("POST", "/admin/v1/public/website-orders", original.request, token, { "x-workspace": original.workspaceId });
      assert.equal(paidAgain.status, 200); assert.deepEqual(paidAgain.body.data, original.order);
      assert.equal((await link(original.order, token, original.workspaceId)).status, 201);
      assert.equal((await link(original.order, token, original.workspaceId)).status, 201);
      const state = platform();
      assert.equal(state.db.publicWebsiteOrders.filter(row => row.snapshot.reference === original.order.reference).length, 1);
      assert.equal(state.db.websiteOrderLinks.filter(row => row.reference === original.order.reference).length, 1);
      assert.equal(state.db.invoices.filter(row => row.reference === original.order.reference).length, 1);
      assert.equal(state.db.serviceRequests.filter(row => row.source?.reference === original.order.reference).length, 1);
      assert.equal(state.db.mailbox.filter(row => row.eventKey === `website-order:${original.order.reference}`).length, 1);
      assert.ok(state.sequence >= original.sequence);
    } else if (step === "deactivate") {
      const original = load(), admin = await signIn(); assert.equal(admin.status, 200);
      assert.equal((await call("PATCH", `/admin/v1/admin/people/${original.accountId}/status`, { isActive: false }, await staffToken(admin.body.data.tokens.accessToken))).status, 200);
    } else if (step === "inactive-cold") {
      const original = load(); assert.equal((await signIn(EMAIL, PASSWORD)).status, 403);
      assert.equal((await call("POST", "/sos/api/auth/refresh", { refreshToken: original.tokens.refreshToken })).status, 401);
      const admin = await signIn(); assert.equal(admin.status, 200);
      assert.equal((await call("GET", `/admin/v1/admin/invoices/${original.invoice.id}`, null, await staffToken(admin.body.data.tokens.accessToken))).status, 200);
      assert.deepEqual(platform().db.invoices.find(row => row.id === original.invoice.id), original.invoice, "Deactivated actor does not invalidate committed financial history");
      assert.equal((await call("GET", "/sos/__mock/status")).body.data.journal.skipped, 0);
    } else if (step === "commit-failure") {
      const signed = await signIn(); assert.equal(signed.status, 200);
      const token = signed.body.data.tokens.accessToken;
      assert.equal((await call("GET", "/sos/v1/app/me", null, token)).status, 200);
      const before = clone(platform()), revision = (await fixtureStore.snapshot()).revision;
      rejectCommit = true;
      const failed = await call("PATCH", "/sos/v1/app/workspace", { name: "Must not survive failed persistence" }, token);
      rejectCommit = false;
      assert.equal(failed.status, 503); assert.notEqual(failed.body.success, true);
      assert.equal((await fixtureStore.snapshot()).revision, revision);
      assert.equal((await call("GET", "/sos/v1/app/me", null, token)).status, 200);
      assert.equal(platform().db.workspaces.find(row => row.id === "ws_orgtik").name, before.db.workspaces.find(row => row.id === "ws_orgtik").name);
      assert.deepEqual(platform().db.invoices, before.db.invoices);
      assert.ok(commits > 0, "Mutation used the fail-closed commit primitive");
    } else if (step === "prime-race") {
      const signed = await signIn(); assert.equal(signed.status, 200);
      assert.equal((await call("GET", "/sos/v1/app/me", null, signed.body.data.tokens.accessToken)).status, 200);
    } else if (step === "race") {
      const signed = await signIn(); assert.equal(signed.status, 200);
      const response = await call("PATCH", "/sos/v1/app/workspace", { name: `CAS winner ${process.env.PLATFORM_ENDPOINT_RACE_NAME}` }, signed.body.data.tokens.accessToken);
      fs.writeFileSync(path.join(process.env.PLATFORM_ENDPOINT_RACE_DIR, `result-${process.env.PLATFORM_ENDPOINT_RACE_NAME}.json`), JSON.stringify(response));
      assert.ok([200, 409].includes(response.status));
    } else if (step === "race-read") {
      const signed = await signIn(); assert.equal(signed.status, 200);
      const me = await call("GET", "/sos/v1/app/me", null, signed.body.data.tokens.accessToken); assert.equal(me.status, 200);
      save({ name: me.body.data.workspace.name, revision: (await fixtureStore.snapshot()).revision });
    } else if (step === 'prime-invite') {
      const account = await register(), token = account.tokens.accessToken;
      const method = await call('POST', '/sos/v1/app/payment-methods', { kind: 'card', last4: '4242', brand: 'visa', expires: '12/30', makeDefault: true }, token);
      assert.equal(method.status, 201, JSON.stringify(method.body));
      const purchased = await call('POST', '/sos/v1/app/checkout/confirm', { items: [{ planId: 'tasks_pro', cycle: 'monthly', quantity: 2 }], intent: 'seat_purchase', paymentMethodId: method.body.data.id }, token, { 'idempotency-key': 'last-seat-fixture' });
      assert.equal(purchased.status, 201, JSON.stringify(purchased.body));
      const seats = await call('GET', '/sos/v1/app/seats', null, token);
      assert.equal(seats.body.data.tasks.available, 1);
    } else if (step === 'invite-race') {
      const signed = await signIn(EMAIL, PASSWORD); assert.equal(signed.status, 200);
      const response = await call('POST', '/sos/v1/app/invitations', { email: `${process.env.PLATFORM_ENDPOINT_RACE_NAME}@last-seat.test`, tools: ['tasks'] }, signed.body.data.tokens.accessToken);
      fs.writeFileSync(path.join(process.env.PLATFORM_ENDPOINT_RACE_DIR, `result-${process.env.PLATFORM_ENDPOINT_RACE_NAME}.json`), JSON.stringify(response));
      assert.ok([200, 409].includes(response.status));
    } else if (step === 'invite-read') {
      const signed = await signIn(EMAIL, PASSWORD); assert.equal(signed.status, 200);
      const token = signed.body.data.tokens.accessToken, seats = await call('GET', '/sos/v1/app/seats', null, token), invitations = await call('GET', '/sos/v1/app/invitations', null, token);
      assert.equal(seats.body.data.tasks.reserved, 1); assert.equal(seats.body.data.tasks.available, 0);
      assert.equal(invitations.body.data.length, 1);
      const ws = platform().db.workspaces.find(row => row.id === signed.body.data.workspaceContext.workspace.id);
      assert.equal(platform().db.mailbox.filter(row => row.workspaceId === ws.id && row.template === 'workspace_invitation').length, 1);
    } else if (step === "legacy-read" || step === "legacy-modern-write") {
      const original = load(), signed = await signIn(); assert.equal(signed.status, 200);
      const token = signed.body.data.tokens.accessToken;
      assert.equal((await call("GET", `/admin/v1/admin/invoices/${original.invoice.id}`, null, await staffToken(token))).status, 200);
      assert.deepEqual(platform().db.invoices.find(row => row.id === original.invoice.id), original.invoice);
      assert.equal(platform().db.grid["chat_pro:monthly:gcc"], 50);
      assert.equal(platform().sequence, original.sequence);
      if (step === "legacy-modern-write") {
        assert.equal((await call("PATCH", "/sos/v1/app/workspace", { name: "Modern checkpoint after legacy" }, token)).status, 200);
        assert.ok((await fixtureStore.read(0)).map(JSON.parse).some(entry => entry.kind === 'workspace-v1' && require('./domain-checkpoint').decodeDomainCheckpoint(entry.checkpoint).platformState.platformVersion === 2));
        assert.deepEqual(platform().db.invoices.find(row => row.id === original.invoice.id), original.invoice);
      }
    } else if (step === "legacy-fence") {
      assert.equal((await call("GET", "/sos/__mock/status")).status, 503, "A late unversioned platform writer cannot bypass the committed snapshot boundary");
    } else if (step === "guest-purchase") {
      const quoted = await quote(), request = paymentBody(quoted, "guest-kwd-payment");
      assert.equal(quoted.currency, "KWD"); assert.equal(quoted.decimals, 3);
      const paid = await call("POST", "/admin/v1/public/website-orders", request); assert.equal(paid.status, 200);
      const account = await register(), token = account.tokens.accessToken;
      const me = await call("GET", "/sos/v1/app/me", null, token); assert.equal(me.status, 200);
      const workspaceId = me.body.data.workspace.id;
      const linked = await link(paid.body.data, token, workspaceId); assert.equal(linked.status, 201);
      const state = platform(), ws = state.db.workspaces.find(row => row.id === workspaceId);
      assert.equal(ws.currency, "KWD"); assert.equal(ws.country, "KW"); assert.equal(ws.billingInitialized, true);
      save({ tokens: account.tokens, workspaceId, order: paid.body.data, invoice: state.db.invoices.find(row => row.reference === paid.body.data.reference) });
    } else if (step === "guest-cold") {
      const original = load(), signed = await signIn(EMAIL, PASSWORD); assert.equal(signed.status, 200);
      const token = signed.body.data.tokens.accessToken;
      const me = await call("GET", "/sos/v1/app/me", null, token); assert.equal(me.status, 200);
      assert.equal(me.body.data.workspace.currency, "KWD"); assert.equal(me.body.data.workspace.country, "KW");
      assert.deepEqual(platform().db.invoices.find(row => row.id === original.invoice.id), original.invoice);
      process.env.MOCK_VISITOR_COUNTRY = "US";
      const q = await quote(); assert.equal(q.currency, "USD");
      const paid = await call("POST", "/admin/v1/public/website-orders", paymentBody(q, "second-usd-payment")); assert.equal(paid.status, 200);
      const before = platform().db.invoices.length;
      const refused = await link(paid.body.data, token, original.workspaceId);
      assert.equal(refused.status, 409); assert.equal(refused.body.error.code, "order_currency_mismatch");
      assert.equal(platform().db.invoices.length, before); assert.equal(platform().db.workspaces.find(row => row.id === original.workspaceId).currency, "KWD");
    } else if (step === "suspended-and-private") {
      const account = await register(), token = account.tokens.accessToken;
      const me = await call("GET", "/sos/v1/app/me", null, token), workspaceId = me.body.data.workspace.id;
      const q = await quote(token, workspaceId), admin = await signIn(), staff = await staffToken(admin.body.data.tokens.accessToken);
      assert.equal((await call("POST", `/admin/v1/admin/workspaces/${workspaceId}/actions`, { action: "suspend", reason: "Isolated suspension regression" }, staff)).status, 200);
      const before = platform().db.publicWebsiteOrders.length;
      const refused = await call("POST", "/admin/v1/public/website-orders", paymentBody(q, "suspended-attempt"), token, { "x-workspace": workspaceId });
      assert.equal(refused.status, 423); assert.equal(refused.body.error.code, "workspace_unavailable");
      assert.equal(platform().db.publicWebsiteOrders.length, before);
      assert.equal((await call("PATCH", "/admin/v1/admin/plans/files_pro", { visibility: "private" }, staff)).status, 200);
      const catalog = await call("GET", "/admin/v1/public/catalog"); assert.equal(catalog.status, 200);
      assert.equal(catalog.body.data.items.some(row => row.id === "files"), false);
      assert.equal(catalog.body.data.bundles.some(row => row.ids.includes("files")), false);
    } else throw new Error(`Unknown isolated endpoint step: ${step}`);
  } finally {
    await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
  }
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-platform-endpoints-"));
  const env = { ...process.env, MOCK_AUTH_STORE: "file", MOCK_AUTH_FILE: path.join(dir, "accounts.json"), MOCK_JOURNAL: "file", MOCK_PUBLIC_URL: "", MOCK_SANDBOX: "isolated-platform-endpoint-fixture", MOCK_NOW: new Date(AT).toISOString(), MOCK_CLOCK: "frozen", MOCK_VISITOR_COUNTRY: "CH", MOCK_HANDOFF_SECRET: "isolated-endpoint-fixture-secret", MOCK_WEBSITE_ORDER_SECRET: "", VERCEL: "", KV_REST_API_URL: "", KV_REST_API_TOKEN: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", PLATFORM_ENDPOINT_JOURNAL: path.join(dir, "journal.json"), PLATFORM_ENDPOINT_FACTS: path.join(dir, "facts.json"), PLATFORM_ENDPOINT_RACE_DIR: dir };
  const start = (step, extra = {}) => {
    const process = spawn(globalThis.process.execPath, [__filename, "--only=sos,admin", "--child", step], { env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    process.stdout.on("data", chunk => { output = (output + chunk).slice(-6000); }); process.stderr.on("data", chunk => { output = (output + chunk).slice(-6000); });
    const done = new Promise((resolve, reject) => { process.once("error", reject); process.once("exit", code => code === 0 ? resolve() : reject(new Error(`Isolated endpoint step ${step} failed (${code}):\n${output}`))); });
    return { process, done };
  };
  return { dir, env, start, async run(step, extra) { await start(step, extra).done; }, cleanup() {
    const target = path.resolve(dir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith("orgtik-platform-endpoints-"));
    fs.rmSync(target, { recursive: true, force: true });
  } };
}

if (process.argv.includes("--child")) {
  child(process.argv[process.argv.indexOf("--child") + 1]).catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
} else {
  const { test } = require("node:test");
  test("modern paid snapshots survive cold start, token refresh, repeats and actor deactivation", { timeout: 120000 }, async () => {
    const f = fixture(); try { for (const step of ["purchase", "cold-repeat", "deactivate", "inactive-cold"]) await f.run(step); } finally { f.cleanup(); }
  });
  test("failed journal commit returns503 and rebuilds rather than exposing an unpersisted mutation", { timeout: 60000 }, async () => {
    const f = fixture(); try { await f.run("commit-failure"); } finally { f.cleanup(); }
  });
  test("concurrent endpoint mutations compete for the same revision and only one commits", { timeout: 90000 }, async () => {
    const f = fixture(); let a, b;
    try {
      await f.run("prime-race");
      a = f.start("race", { PLATFORM_ENDPOINT_RACE_NAME: "A" }); b = f.start("race", { PLATFORM_ENDPOINT_RACE_NAME: "B" });
      // Attach rejection handlers immediately so a failed child is never an unhandled promise.
      const finished = Promise.all([a.done, b.done]); finished.catch(() => {});
      await Promise.race([waitFor(() => fs.existsSync(path.join(f.dir, "ready-A.json")) && fs.existsSync(path.join(f.dir, "ready-B.json")), "both isolated endpoint instances"), finished.then(() => { throw new Error("Endpoint instances exited before the CAS barrier"); })]);
      const read = name => JSON.parse(fs.readFileSync(path.join(f.dir, name), "utf8"));
      assert.deepEqual(read("ready-A.json"), read("ready-B.json"));
      fs.writeFileSync(path.join(f.dir, "release"), "go"); await finished;
      const results = [read("result-A.json"), read("result-B.json")]; assert.deepEqual(results.map(row => row.status).sort(), [200, 409]);
      const winner = results.findIndex(row => row.status === 200) === 0 ? "A" : "B";
      await f.run("race-read"); assert.equal(read("facts.json").name, `CAS winner ${winner}`);
    } finally { a?.process.kill(); b?.process.kill(); f.cleanup(); }
  });
  test("legacy financial IDs/amounts survive migration and later unversioned writers are fenced", { timeout: 90000 }, async () => {
    const f = fixture();
    try {
      const { fileStore } = require("./journal"), { createLegacyPlatform } = require("./platform-replay");
      const store = fileStore(f.env.PLATFORM_ENDPOINT_JOURNAL), meta = { epoch: "isolated-legacy-epoch", seedAt: AT, clock: { mode: "frozen", at: AT } };
      await store.initialize(meta);
      const frozen = createLegacyPlatform({ identity: { users: [] } }, { seedAt: AT });
      const encoded = value => Buffer.from(JSON.stringify(value)).toString("base64url");
      const legacyToken = `${encoded({ typ: "JWT" })}.${encoded({ sub: 1, id: 1, exp: 1 })}.original-accepted-fixture`;
      const entry = (app, url, body, actor = true) => ({ epoch: meta.epoch, app, method: "POST", url, at: AT, seed: `original:${url}`, headers: { "content-type": "application/json", ...(actor ? { authorization: `Bearer ${legacyToken}`, "x-workspace": "ws_orgtik" } : {}) }, body: Buffer.from(JSON.stringify(body)).toString("base64") });
      const apply = async e => { const result = await frozen.replayAccepted(e); await store.push(e); return result; };
      await apply(entry("admin", "/v1/__mock/fail-next-payment", { count: 0 }, false));
      await apply(entry("admin", "/v1/__mock/advance", {}, false));
      const paid = await apply(entry("sos", "/v1/app/checkout/confirm", { items: [{ planId: "tasks_pro", cycle: "yearly", seats: 2 }], paymentMethodId: "pm_1" }));
      const draft = await apply(entry("admin", "/v1/admin/price-drafts", { changes: [{ key: "chat_pro:monthly:gcc", to: 50 }] }));
      await apply(entry("admin", `/v1/admin/price-drafts/${draft.body.data.id}/publish`, { effectiveAt: new Date(AT + 30 * 86400000).toISOString(), applyMode: "new_only", reason: "Legacy accepted future publication" }));
      const state = frozen.exportState(), invoice = state.db.invoices.find(row => row.id === paid.body.data.invoice.id);
      assert.equal(invoice.total, 2500.02);
      fs.writeFileSync(f.env.PLATFORM_ENDPOINT_FACTS, JSON.stringify({ invoice, sequence: state.sequence }));
      await f.run("legacy-read"); await f.run("legacy-modern-write");
      await store.push(entry("sos", "/v1/app/team/invite", { email: "late@fixture.test", role: "member" }));
      await f.run("legacy-fence");
    } finally { f.cleanup(); }
  });
  test('separate mock instances competing for the last seat commit one invitation and one mailbox notice', { timeout: 90000 }, async () => {
    const f = fixture(); let a, b;
    try {
      await f.run('prime-invite');
      a = f.start('invite-race', { PLATFORM_ENDPOINT_RACE_NAME: 'A' }); b = f.start('invite-race', { PLATFORM_ENDPOINT_RACE_NAME: 'B' });
      const finished = Promise.all([a.done, b.done]); finished.catch(() => {});
      await Promise.race([waitFor(() => fs.existsSync(path.join(f.dir, 'ready-A.json')) && fs.existsSync(path.join(f.dir, 'ready-B.json')), 'both invitation instances at CAS'), finished.then(() => { throw new Error('Invitation instances exited before CAS'); })]);
      const read = name => JSON.parse(fs.readFileSync(path.join(f.dir, name), 'utf8'));
      assert.deepEqual(read('ready-A.json'), read('ready-B.json'));
      fs.writeFileSync(path.join(f.dir, 'release'), 'go'); await finished;
      assert.deepEqual([read('result-A.json').status, read('result-B.json').status].sort(), [200, 409]);
      await f.run('invite-read');
    } finally { a?.process.kill(); b?.process.kill(); f.cleanup(); }
  });
  test("guest KWD purchase establishes new billing once and remains immutable across cold starts", { timeout: 90000 }, async () => {
    const f = fixture(); try { await f.run("guest-purchase", { MOCK_VISITOR_COUNTRY: "KW" }); await f.run("guest-cold", { MOCK_VISITOR_COUNTRY: "KW" }); } finally { f.cleanup(); }
  });
  test("suspended owners cannot pay and catalog presets never advertise hidden members", { timeout: 60000 }, async () => {
    const f = fixture(); try { await f.run("suspended-and-private"); } finally { f.cleanup(); }
  });
}
