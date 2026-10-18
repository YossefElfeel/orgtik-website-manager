const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const net = require("node:net");
const express = require("express");
const { test } = require("node:test");
const { createLegacyPlatform } = require("./platform-replay");
const clock = require("./clock");
const { makeStore } = require("../apps/admin/store");
const modernAppApi = require("../apps/admin/app-api");

const AT = Date.parse("2026-10-07T09:00:00Z");
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = id => `${encode({ typ: "JWT" })}.${encode({ sub: id, id, exp: 1, type: "access", email: "original@fixture.test" })}.recorded-accepted-fixture`;
const entry = (url, body, { app = "sos", id = 1, at = AT, method = "POST", workspace = "ws_orgtik" } = {}) => ({ app, method, url, at, seed: `entry:${url}:${at}`, headers: { authorization: `Bearer ${token(id)}`, "content-type": "application/json", "x-workspace": workspace }, body: body ? Buffer.from(JSON.stringify(body)).toString("base64") : null });
const legacy = users => createLegacyPlatform({ identity: { users: users || [], userFromReq() { throw new Error("Live authentication must never execute historical requests"); } } }, { seedAt: AT, seed: `seed:${AT}` });

function invokeLive(app, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = new http.IncomingMessage(new net.Socket()); req.method = "POST"; req.url = url; req.headers = headers; req.body = body || {};
    const res = new http.ServerResponse(req);
    res.end = payload => { resolve({ status: res.statusCode, body: payload ? JSON.parse(String(payload)) : null }); return res; };
    app.handle(req, res, e => reject(e || new Error("No route")));
  });
}

test("frozen source bytes match their original33bd33e Git blobs", () => {
  const expected = { "platform.js": "c000da714b3945a515f9712d4579a84497c30a37", "store.js": "74de4aa3930091241f566a8592209463f2da9681", "pricing.js": "f4fac8f435cf8f89196296cda86957ab2851c34d", "lifecycle.js": "35ef30a7878297249ab1d9a11535747433cb12ce", "permissions.js": "6ff62b36a009259b98a3f884f23bc6f698da1d3e", "seed-catalog.js": "8ad8a70067af2b39ca91187ca4192408ea1e05b9", "seed-pricing.js": "11390b6ea77a43235197b6101a4f842a0623a093", "app-api.js": "71d0dc756085f47fc037eb7f5ae3f976b0daa3a5", "admin-api.js": "2fc72e09f2a8b66fc534a8aa5f53ece560b5e249", "identity.js": "9fa8eaf73588e93d405c5c5c2fe18fca54fbc1e0" };
  for (const [file, hash] of Object.entries(expected)) {
    const bytes = fs.readFileSync(path.join(__dirname, "../apps/admin/legacy-v1", file));
    assert.equal(crypto.createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex"), hash, file);
  }
});

test("original sixteen-person membership survives current deactivation and newer signup accounts", () => {
  const future = { id: 100001, key: "signup_100001", firstName: "Future", lastName: "Buyer", email: "future@fixture.test", isActive: false, createdAt: new Date(AT + 86400000).toISOString(), signupInfo: { company: "Future Company" } };
  const replay = legacy([{ id: 1, key: "admin", isActive: false, deletedAt: new Date(AT).toISOString() }, future]);
  assert.equal(replay.identity.users.length, 16);
  const orgtik = replay.state.workspace("ws_orgtik");
  assert.equal(orgtik.members.filter(row => row.userKey).length, 15);
  assert.equal(replay.identity.findUser(1).isActive, true);
  assert.equal(orgtik.members.some(row => row.userKey === future.key), false);
  assert.equal(replay.restoreRegistrations(AT + 86400000), 1);
  assert.equal(replay.state.workspace(`ws_${future.key}`).members[0].role, "owner");
  assert.equal(orgtik.members.some(row => row.userKey === future.key), false, "Signup stays independent from original OrgTik seat counts");
});

test("expired recorded tokens replay the exact old checkout quantity, bundle and tax money", async () => {
  const replay = legacy([{ id: 1, key: "admin", isActive: false }]);
  const result = await replay.replayAccepted(entry("/v1/app/checkout/confirm", { items: [{ planId: "tasks_pro", cycle: "yearly", seats: 2 }], paymentMethodId: "pm_1" }));
  assert.equal(result.statusCode, 201);
  assert.equal(result.body.data.lines[0].snapshot.quantity, 2);
  assert.equal(result.body.data.lines[0].snapshot.amount, 2580);
  assert.equal(result.body.data.invoice.total, 2500.02);
  const state = replay.exportState(), invoice = state.db.invoices.find(row => row.id === result.body.data.invoice.id);
  assert.equal(invoice.subtotal, 2580); assert.equal(invoice.bundleDiscount, 387);
  assert.equal(invoice.tax, 307.02); assert.equal(invoice.total, 2500.02);
  assert.equal(invoice.payments[0].amount, 2500.02);
  assert.equal(invoice.payments[0].usdRate, 48.5);
  assert.equal(state.sequence, Number(result.body.data.lines[0].id.split("_").at(-1)));
  assert.equal(state.sourceCommit, "33bd33e");
});

test("legacy future publish immediately changes old grid exactly as the old accepted handler did", async () => {
  const replay = legacy();
  const drafted = await replay.replayAccepted(entry("/v1/admin/price-drafts", { changes: [{ key: "chat_pro:monthly:gcc", to: 50 }] }, { app: "admin" }));
  await replay.replayAccepted(entry(`/v1/admin/price-drafts/${drafted.body.data.id}/publish`, { effectiveAt: new Date(AT + 30 * 86400000).toISOString(), applyMode: "new_only", reason: "Original accepted future price fixture" }, { app: "admin" }));
  assert.equal(replay.state.db.grid["chat_pro:monthly:gcc"], 50, "R0's corrected delayed publishing must not recalculate legacy history");
  const preview = await replay.replayAccepted(entry("/v1/admin/price-preview?planId=chat_pro&country=SA", null, { app: "admin", method: "GET" }));
  assert.equal(preview.body.data[0].amount, 50);
});

test("paid legacy invoice bytes remain unchanged when adopted by modern handlers and new commands", async () => {
  const replay = legacy();
  const old = await replay.replayAccepted(entry("/v1/app/checkout/confirm", { items: [{ planId: "tasks_pro", cycle: "yearly", seats: 2 }], paymentMethodId: "pm_1" }));
  const snapshot = replay.exportState(), immutableInvoice = JSON.stringify(snapshot.db.invoices.find(row => row.id === old.body.data.invoice.id));
  const users = replay.identity.users.map(user => ({ ...user }));
  const identity = { users, userFromReq: () => users.find(user => user.id === 1), findByKey: key => users.find(user => user.key === key), fullName: user => `${user.firstName} ${user.lastName}` };
  const modern = clock.runPinned({ at: AT, seed: "modern-adoption-fixture" }, () => makeStore({ identity }));
  // Parent's production importer must restore its private counter as well. This fixture sets
  // the external allocation seam used by the checked current checkout handler, never sources.
  for (const key of Object.keys(modern.db)) delete modern.db[key];
  Object.assign(modern.db, JSON.parse(JSON.stringify(snapshot.db)));
  let sequence = snapshot.sequence; modern.id = prefix => `${prefix}_${++sequence}`;
  const app = express(), H = { ok: (res, data, meta = {}, status = 200) => res.status(status).json({ data, meta }), fail: (res, status, code, message) => res.status(status).json({ error: { code, message } }), page: (_req, res, data) => res.json({ data }) };
  modernAppApi(app, { identity }, modern, H);
  const next = await clock.runPinned({ at: AT + 86400000, seed: "modern-command-fixture" }, () => invokeLive(app, "/v1/app/checkout/confirm", { items: [{ planId: "tasks_pro", cycle: "monthly", seats: 999 }], paymentMethodId: "pm_1" }, { "x-workspace": "ws_orgtik" }));
  assert.equal(next.status, 201);
  assert.equal(next.body.data.lines[0].snapshot.quantity, 2, "New R0 command uses purchased capacity, not browser seats");
  assert.equal(JSON.stringify(modern.db.invoices.find(row => row.id === old.body.data.invoice.id)), immutableInvoice);
  assert.ok(sequence > snapshot.sequence);
});

test("a mixed legacy-prefix/new-checkpoint boundary exports committed amounts verbatim and fences late old writers", async () => {
  const replay = legacy();
  await replay.replayAccepted(entry("/v1/app/checkout/confirm", { items: [{ planId: "tasks_pro", cycle: "yearly", seats: 2 }], paymentMethodId: "pm_1" }));
  const committed = replay.exportState(); committed.sequence += 3; committed.sourceCommit = "modern-checkpoint-fixture";
  committed.db.invoices.push({ id: `inv_${committed.sequence}`, state: "paid", total: 17.23, currency: "CHF", payments: [{ amount: 17.23 }] });
  replay.adoptCommittedSnapshot(committed);
  committed.db.invoices.at(-1).total = 999;
  assert.equal(replay.exportState().db.invoices.at(-1).total, 17.23);
  assert.equal(replay.exportState().sequence, committed.sequence);
  await assert.rejects(replay.replayAccepted(entry("/v1/app/team/invite", { email: "late@fixture.test", role: "member" })), { code: "legacy_after_checkpoint" });
  assert.throws(() => replay.adoptCommittedSnapshot({ db: {} }), { code: "platform_checkpoint_invalid" });
});

test("client headers cannot enter private historical routers and missing original actors fail closed", async () => {
  const replay = legacy();
  const publicAttempt = await invokeLive(replay.router.sos, "/v1/app/checkout/confirm", { items: [{ planId: "tasks_pro", seats: 2 }], paymentMethodId: "pm_1" }, { authorization: `Bearer ${token(1)}`, "x-mock-replay": "1" });
  assert.equal(publicAttempt.status, 403); assert.equal(publicAttempt.body.error.code, "private_replay_only");
  await assert.rejects(replay.replayAccepted(entry("/v1/app/checkout/confirm", {}, { id: 999999 })), { code: "legacy_actor_missing" });
  await assert.rejects(replay.replayAccepted(entry("/api/auth/login", { email: "irrelevant" })), { code: "legacy_route_unavailable" });
  await assert.rejects(replay.replayAccepted(entry("/v1/admin/settings", {}, { app: "sos" })), { code: "legacy_route_unavailable" });
  assert.throws(() => replay.exportState(), { code: "legacy_replay_incomplete" });
});

test("accepted-history mismatches cannot export a partially mutated financial state", async () => {
  const replay = legacy();
  const original = replay.exportState();
  await assert.rejects(replay.replayAccepted(entry("/v1/app/checkout/confirm", { items: [{ planId: "missing-historical-plan" }], paymentMethodId: "pm_1" })), { code: "legacy_replay_refused" });
  assert.throws(() => replay.exportState(), { code: "legacy_replay_incomplete" });
  const authoritative = { ...original, sourceCommit: "trusted-committed-checkpoint" };
  replay.adoptCommittedSnapshot(authoritative);
  assert.deepEqual(replay.exportState(), authoritative, "Only a complete trusted domain snapshot may recover a refused prefix");
});
