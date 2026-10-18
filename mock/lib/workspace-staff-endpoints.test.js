// Main HTTP boundary + a second cold process. Only disposable local files are used;
// business time is fixed at startup and no reset/advance/provider request is made.
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { spawn } = require("node:child_process");
const AT = "2026-10-07T09:00:00.000Z";
const clone = value => JSON.parse(JSON.stringify(value));
async function child(phase) {
  const config = require("../config"); config.dataDir = process.env.STAFF_ENDPOINT_DIR;
  const journal = require("./journal"), store = journal.fileStore(path.join(config.dataDir, "journal.json"));
  let refuseCommit = false;
  const commit = store.commit.bind(store);
  store.commit = (...args) => refuseCommit ? Promise.reject(Object.assign(new Error("Isolated WM persistence failure"), { status: 503, code: "journal_unavailable" })) : commit(...args);
  journal.pickStore = () => ({ sandbox: process.env.MOCK_SANDBOX, store });
  const server = require("node:http").createServer(require("../api/index")); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`, factsFile = path.join(config.dataDir, "facts.json");
  const wm = () => require("../apps/wm"), platform = () => require("../apps/admin");
  async function call(app, route, method = "GET", body, token, extra = {}) {
    const response = await fetch(`${base}/${app}${route}`, { method, headers: { connection: "close", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
    const text = await response.text(), raw = text ? JSON.parse(text) : {};
    return { status: response.status, raw, data: raw.data ?? raw };
  }
  const clock = () => require("./clock").now();
  const caseFrom = value => value.find(row => row.id === "cs_01");
  try {
    if (phase === "write") {
      const published = await call("wm", "/v2/public/entries/caseStudy"); assert.equal(published.status, 200);
      const originalLiveName = caseFrom(published.data).locales.en.name;
      assert.equal((await call("wm", "/v2/admin/entries/caseStudy/cs_01")).status, 401);
      assert.equal((await call("wm", "/v2/preview/entries/caseStudy")).status, 401);
      const customer = await call("sos", "/api/auth/register", "POST", { email: "customer@staff-codec.fixture.test", name: "Customer Workspace Owner", password: "StrongFixture!" }); assert.equal(customer.status, 201);
      assert.equal(customer.data.workspaceContext.member.role, "owner");
      assert.equal((await call("wm", "/v2/admin/me", "GET", undefined, customer.data.tokens.accessToken)).status, 401);
      const login = await call("sos", "/api/auth/login", "POST", { email: "mona.adel@orgtik.test", password: "Local@2026", mode: "staff", target: "wm" }); assert.equal(login.status, 200);
      const token = login.data.tokens.accessToken;
      assert.equal(login.data.workspaceContext, null); assert.ok(login.data.staffAccess.permissions.wm.includes("content:edit"));
      const me = await call("wm", "/v2/admin/me", "GET", undefined, token); assert.equal(me.status, 200); assert.ok(me.data.permissions.length > 0);
      const name = "WM draft committed by the main boundary";
      const editBody = { locale: "en", fields: { name }, note: "Isolated staff-state regression" };
      const changed = await call("wm", "/v2/admin/entries/caseStudy/cs_01", "PATCH", editBody, token); assert.equal(changed.status, 200); assert.equal(changed.data.content.locales.en.name, name);
      const originalContent = wm().exportState();
      const grant = await call("wm", "/v2/admin/preview-token", "POST", {}, token); assert.equal(grant.status, 200);
      const previewToken = grant.data.token, snapshot = wm().exportState(); assert.equal(JSON.stringify(snapshot).includes(previewToken), false); assert.ok(snapshot.data.previews.every(([hash]) => /^[a-f0-9]{64}$/.test(hash)));
      const preview = await call("wm", "/v2/preview/entries/caseStudy", "GET", undefined, null, { authorization: `Preview ${previewToken}` }); assert.equal(preview.status, 200); assert.equal(caseFrom(preview.data).locales.en.name, name);
      assert.equal(caseFrom((await call("wm", "/v2/public/entries/caseStudy")).data).locales.en.name, originalLiveName);
      const stored = await store.snapshot();
      const decoded = stored.entries.map(JSON.parse).filter(entry => entry.checkpoint).map(entry => require("./domain-checkpoint").decodeDomainCheckpoint(entry.checkpoint));
      assert.ok(decoded.some(value => value.staffState?.wm?.data.content.entries.some(([id, row]) => id === "cs_01" && row.draft?.locales.en.name === name)));
      assert.ok(decoded.some(value => value.staffState?.wm?.data.previews.length > 0));
      assert.equal(decoded.some(value => JSON.stringify(value.staffState).includes(previewToken)), false);
      const beforeFailure = clone(wm().exportState()), revision = (await store.snapshot()).revision;
      refuseCommit = true;
      const failed = await call("wm", "/v2/admin/entries/caseStudy/cs_01", "PATCH", { locale: "en", fields: { name: "Must roll back" } }, token); refuseCommit = false; assert.equal(failed.status, 503);
      assert.equal((await store.snapshot()).revision, revision);
      assert.equal((await call("wm", "/v2/admin/entries/caseStudy/cs_01", "GET", undefined, token)).data.content.locales.en.name, name);
      assert.deepEqual(wm().exportState(), beforeFailure);
      refuseCommit = true;
      assert.equal((await call("wm", "/v2/admin/preview-token", "POST", {}, token)).status, 503); refuseCommit = false;
      assert.equal((await call("wm", "/v2/admin/me", "GET", undefined, token)).status, 200); assert.deepEqual(wm().exportState(), beforeFailure);
      const multipart = await call("wm", "/v2/admin/media", "POST", undefined, token, { "content-type": "multipart/form-data; boundary=fixture" }); assert.equal(multipart.status, 422);
      const form = new FormData();
      form.set("file", new Blob(["<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>"] , { type: "image/svg+xml" }), "persisted-fixture.svg");
      form.set("description", "Boundary upload fixture"); form.set("tags", JSON.stringify(["fixture", "cms"]));
      const uploadResponse = await fetch(`${base}/wm/v2/admin/media`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
      assert.equal(uploadResponse.status, 201); const uploaded = (await uploadResponse.json()).data;
      assert.equal((await fetch(`${base}/wm${uploaded.url}`)).status, 200);
      assert.equal(me.data.identity.accounts, true);
      const account = await call("wm", "/v2/admin/users", "POST", { firstName: "Test", lastName: "Account", email: "cms-account@staff-codec.fixture.test", password: "OnlyForFixtures!2026" }, token); assert.equal(account.status, 201);
      const roleChange = await call("wm", `/v2/admin/users/${account.data.id}`, "PATCH", { roles: ["wm_editor"] }, token, { "if-match": account.data.version }); assert.equal(roleChange.status, 200);
      assert.deepEqual(roleChange.data.roles, ["wm_editor"]);
      assert.equal((await call("wm", `/v2/admin/users/${account.data.id}`, "PATCH", { active: false }, token, { "if-match": account.data.version })).status, 412);
      const deactivated = await call("wm", `/v2/admin/users/${account.data.id}`, "PATCH", { active: false }, token, { "if-match": roleChange.data.version }); assert.equal(deactivated.status, 200);
      assert.equal(deactivated.data.active, false);
      assert.ok(wm().exportState().data.content.audit.some(event => event.action === "user_roles" && event.entry === account.data.key));
      const publicSite = await call("wm", "/v2/public/site"); assert.equal(publicSite.status, 200);
      if (!publicSite.data.forms.privacyVersion) {
        const privacy = wm().exportState(); privacy.data.content.entries.find(([id]) => id === "lg_privacy")[1].legalVersions = [{ versionLabel: "staff-fixture-privacy", effectiveFrom: "2020-01-01T00:00:00.000Z" }]; wm().importState(privacy);
      }
      const privacyVersion = (await call("wm", "/v2/public/site")).data.forms.privacyVersion;
      const body = { name: "Visitor", email: "visitor@staff-codec.fixture.test", topic: "Product", message: "WM should keep this request", consent: true, privacyVersion };
      const lead = await call("wm", "/v2/public/leads", "POST", body); assert.equal(lead.status, 201); assert.equal(lead.data.sales.state, "deferred");
      assert.equal(lead.data.sales.code, "crm_intake_pending");
      const idea = await call("wm", "/v2/public/ideas", "POST", { ...body, message: "Persistent public idea" }, null, { "idempotency-key": "staff-idea-proof" }); assert.equal(idea.status, 201);
      assert.equal(clock(), Date.parse(AT));
      fs.writeFileSync(factsFile, JSON.stringify({ token, previewToken, name, originalLiveName, uploaded, account: deactivated.data, snapshot: wm().exportState(), leadId: lead.data.id, ideaId: idea.data.id, ideaBody: { ...body, message: "Persistent public idea" }, originalContentVersion: originalContent.data.content.entries.find(([id]) => id === "cs_01")[1].workflow.version }));
    } else if (phase === "cold") {
      const facts = JSON.parse(fs.readFileSync(factsFile, "utf8"));
      assert.equal((await call("wm", "/v2/admin/me", "GET", undefined, facts.token)).status, 200);
      assert.deepEqual(wm().exportState(), facts.snapshot);
      assert.equal((await fetch(`${base}/wm${facts.uploaded.url}`)).status, 200);
      assert.equal((await call("wm", `/v2/admin/media/${facts.uploaded.id}`, "GET", undefined, facts.token)).data.description, "Boundary upload fixture");
      const accounts = await call("wm", "/v2/admin/users?search=cms-account", "GET", undefined, facts.token);
      assert.deepEqual(accounts.data[0], facts.account);
      assert.equal((await call("sos", "/api/auth/login", "POST", { email: facts.account.email, password: "OnlyForFixtures!2026", mode: "staff", target: "wm" })).status, 403);
      assert.equal((await call("wm", "/v2/admin/entries/caseStudy/cs_01", "GET", undefined, facts.token)).data.content.locales.en.name, facts.name);
      assert.equal(caseFrom((await call("wm", "/v2/public/entries/caseStudy")).data).locales.en.name, facts.originalLiveName);
      assert.equal(caseFrom((await call("wm", "/v2/preview/entries/caseStudy", "GET", undefined, null, { authorization: `Preview ${facts.previewToken}` })).data).locales.en.name, facts.name);
      assert.equal((await call("wm", "/v2/preview/entries/caseStudy?token=ignored")).status, 401);
      const duplicate = await call("wm", "/v2/public/ideas", "POST", facts.ideaBody, null, { "idempotency-key": "staff-idea-proof" }); assert.equal(duplicate.status, 200); assert.equal(duplicate.data.id, facts.ideaId); assert.equal(duplicate.data.duplicate, true);
      assert.equal((await call("wm", `/v2/admin/leads/${facts.leadId}`, "GET", undefined, facts.token)).data.handoff.state, "deferred");
      const beforeRevocation = platform().exportState(), revoked = clone(beforeRevocation);
      revoked.db.workspaces.find(row => row.id === "ws_orgtik").members.find(member => member.userKey === "admin").role = "guest";
      platform().importState(revoked);
      assert.equal((await call("wm", "/v2/preview/entries/caseStudy", "GET", undefined, null, { authorization: `Preview ${facts.previewToken}` })).status, 401);
      assert.equal((await call("wm", "/v2/admin/me", "GET", undefined, facts.token)).status, 403);
      platform().importState(beforeRevocation);
      assert.equal(clock(), Date.parse(AT));
    } else throw new Error("Unknown staff endpoint test phase");
    console.log(`Isolated WM staff boundary ${phase} passed`);
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}
if (process.argv.includes("--staff-child")) child(process.argv[process.argv.indexOf("--staff-child") + 1]).catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
else {
  const { test } = require("node:test");
  test("WM main boundary persists staff CMS/hashed previews and rolls back failed CAS across cold restart", { timeout: 120000 }, async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-staff-http-"));
    const env = { ...process.env, STAFF_ENDPOINT_DIR: folder, MOCK_AUTH_STORE: "file", MOCK_AUTH_FILE: path.join(folder, "accounts.json"), MOCK_JOURNAL: "file", MOCK_SANDBOX: `staff-http-${process.pid}`, MOCK_CLOCK: "frozen", MOCK_NOW: AT, MOCK_PUBLIC_URL: "", VERCEL: "", KV_REST_API_URL: "", KV_REST_API_TOKEN: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" };
    const run = phase => new Promise((resolve, reject) => { const child = spawn(process.execPath, [__filename, "--only=sos,admin,wm", "--staff-child", phase], { env, stdio: ["ignore", "pipe", "pipe"] }); let output = ""; child.stdout.on("data", value => output += value); child.stderr.on("data", value => output += value); child.on("error", reject); child.on("exit", code => code === 0 ? resolve() : reject(new Error(`WM ${phase} exited ${code}\n${output.slice(-6500)}`))); });
    try { await run("write"); await run("cold"); }
    finally { const resolved = fs.realpathSync(folder), parent = fs.realpathSync(os.tmpdir()) + path.sep; assert.ok(resolved.startsWith(parent) && path.basename(resolved).startsWith("orgtik-staff-http-")); fs.rmSync(resolved, { recursive: true, force: true }); }
  });
}
