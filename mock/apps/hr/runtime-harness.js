// Adapter-only HTTP tests. The server's signed sessions and commit boundary have separate tests.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const express = require("express");
const baseUtil = require("../../lib/util");
const { createPrivateModuleGraph } = require("../../lib/private-module-graph");
const { createBusinessCalendar } = require("../../lib/business-calendar");
const plain = value => JSON.parse(JSON.stringify(value));
const sourcePeople = require("../../lib/identity").users.map(user => {
  const { password, passwordHash, ...safe } = user; return plain(safe);
});
const scopes = { hr: "hr_system", sales: "sales", marketing: "digital_marketing" };
const fixtureRoles = {
  hr: { admin: ["super_admin"], manager: ["manager"], u15: ["manager"], u10: ["hr"], finance: ["finance_manager"] },
  sales: { admin: ["admin"], manager: ["manager"], u15: ["manager"], sales: ["salesman"], u13: ["salesman"], customer: ["customer"] },
  marketing: { admin: ["super_admin"], manager: ["marketing_manager"], u12: ["marketing_specialist"], u14: ["content_writer"], customer: ["client_reviewer"] },
};
const adminRole = { hr: "super_admin", sales: "admin", marketing: "super_admin" };
function runtime(appKey, workspaceId, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-owned-runtime-"));
  const now = { value: Date.parse(options.now || "2026-10-07T09:00:00Z") };
  class BusinessDate extends Date { constructor(...args) { super(...(args.length ? args : [now.value])); } static now() { return now.value; } }
  const clock = createBusinessCalendar(options.timeZone || "Africa/Cairo", () => now.value);
  const people = plain(options.people || (options.fixtureId === "orgtik-v1" ? sourcePeople : options.fixtureId === "nile-v1" ? sourcePeople.filter(user => user.key === "customer") : sourcePeople.slice(0, 2)));
  const assigned = options.roles || (options.fixtureId ? fixtureRoles[appKey] : Object.fromEntries(people.map(user => [user.key, [adminRole[appKey]]])));
  const scope = scopes[appKey];
  const identity = {
    realm: "adapter-tests", workspaceId, workspaceMode: true, users: people, seedUsers: people,
    grants: { [scope]: Object.fromEntries(people.map(user => [user.key, { roles: assigned[user.key] || [] }])), global: { admin: { roles: ["super_admin"] } } },
    findUser: id => people.find(user => user.id === Number(id)), findByKey: key => people.find(user => user.key === key), findByEmail: email => people.find(user => user.email === String(email).toLowerCase()),
    userScopes: user => [{ scope: "global", roles: ["super_admin"] }, ...(assigned[user.key]?.length ? [{ scope, roles: assigned[user.key] }] : [])],
    fullName: user => `${user.firstName} ${user.lastName}`,
    publicUser: user => plain(user), scopeByName: () => ({ name: scope }),
    currentContext: () => null, canWrite: () => true,
    userFromReq: req => identity.findUser(req.headers["x-user"] || people[0]?.id),
    requireUser(req, res) { const user = this.userFromReq(req); if (!user) { baseUtil.fail(res, 401, "Sign in again"); return null; } req.user = user; return user; },
  };
  const config = { apps: { hr: {}, sales: {}, marketing: {} }, apiUrl: key => `http://fixture.test/${workspaceId}/${key}`, webUrl: key => `http://fixture.test/${key}`, dataDir: root };
  const util = { ...baseUtil, nowIso: () => clock.iso(now.value), daysFromNow: (days, hours = 0) => clock.iso(now.value + days * 864e5 + hours * 36e5), createStore: (rows, options = {}) => baseUtil.createStore(rows, { now: () => clock.iso(now.value), ...options }) };
  const owned = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (/\.(js|json)$/.test(entry.name)) owned.push(path.relative(path.resolve(__dirname, "../.."), file).replace(/\\/g, "/")); } };
  walk(path.resolve(__dirname, "..", appKey));
  const manifest = [`apps/${appKey}.js`, `lib/tool-adapters/${appKey}.js`, 'lib/business-calendar.js', 'lib/clock.js', ...owned];
  const graph = createPrivateModuleGraph({ appKey, identity, config, util, Date: BusinessDate, manifest });
  const upload = () => (req, res, next) => String(req.headers["content-type"] || "").startsWith("multipart/") ? res.status(501).json({ code: "sample_assets_only" }) : next();
  const ctx = { key: appKey, realm: "adapter-tests", workspaceId, config, identity, util, uploadsDir: root, log() {}, upload: { any: upload, single: upload, array: upload, none: upload }, apiUrl: config.apiUrl, webUrl: config.webUrl, fileUrl: name => `${config.apiUrl(appKey)}/uploads/${encodeURIComponent(name)}` };
  const input = { realm: "adapter-tests", appKey, workspace: { id: workspaceId, name: workspaceId, timeZone: clock.timeZone, currency: "EGP" }, initialization: { kind: options.fixtureId ? "fixture" : "empty", ...(options.fixtureId ? { fixtureId: options.fixtureId } : {}), seedAt: "2026-10-07T09:00:00Z" }, identity, clock, services: { ctx, ...(options.lifecycle ? { lifecycle: options.lifecycle } : {}), verifyActorPassword: password => password === "test-password" }, assets: {}, snapshot: options.snapshot };
  let instance;
  const close = () => {
    instance?.close(); graph.close();
    const resolved = fs.realpathSync(root), prefix = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(prefix) || !path.basename(resolved).startsWith("orgtik-owned-runtime-")) throw new Error("Unsafe test cleanup target");
    fs.rmSync(resolved, { recursive: true, force: true });
  };
  try { instance = graph.load().createWorkspaceRuntime(input); }
  catch (error) { close(); throw error; }
  return { instance, identity, input, graph, now, close };
}
async function harness(instances) {
  const app = express(); app.use(express.json());
  instances.forEach((fixture, index) => app.use(`/${index}`, fixture.instance.router));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ code: error.code, message: error.message }));
  const server = http.createServer(app); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { call(index, method, route, body, headers = {}) {
    const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
    return new Promise((resolve, reject) => {
      const request = http.request({ host: "127.0.0.1", port: server.address().port, path: `/${index}${route}`, method, agent: false, headers: { ...headers, ...(bytes ? { "content-type": "application/json", "content-length": bytes.length } : {}) } }, response => {
        const chunks = []; response.on("data", chunk => chunks.push(chunk)); response.on("end", () => { const raw = Buffer.concat(chunks); let json; try { json = JSON.parse(raw.toString()); } catch {} resolve({ status: response.statusCode, json, raw }); });
      }); request.on("error", reject); request.end(bytes);
    });
  }, async close() { await new Promise(resolve => server.close(resolve)); instances.forEach(fixture => fixture.close()); } };
}
const context = (fixture, key, userId = fixture.identity.users[0]?.id, access = "active") => ({ realm: fixture.input.realm, workspace: fixture.input.workspace, actor: { effectiveUserId: userId }, tools: { [key]: { access, canWrite: access !== "read_only" } } });
module.exports = { runtime, harness, plain, context };
