const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runtime, harness, plain, context } = require("../hr/runtime-harness");
const customer = name => ({ fullName: name, email: `${name.toLowerCase()}@fixture.test`, phoneNumber: "+20123456789", countryCode: "EG" });

test("CRM empty workspace retains catalog references but no customer/demo business", async () => {
  const a = runtime("sales", "ws_a"), b = runtime("sales", "ws_b"), http = await harness([a, b]);
  try {
    assert.equal(a.instance.bootstrap(context(a, "crm")).state, "empty");
    const before = plain(a.instance.exportSnapshot());
    assert.ok(before.data.db.plans.length > 0); assert.equal(before.data.db.loyalty.transactions.length, 0);
    const [one, two] = await Promise.all([http.call(0, "POST", "/api/customers", customer("Alpha")), http.call(1, "POST", "/api/customers", customer("Beta"))]);
    assert.equal(one.status, 201); assert.equal(two.status, 201);
    assert.equal((await http.call(1, "GET", `/api/customers/${one.json.data.id}`)).status, 404);
    assert.equal(a.instance.exportSnapshot().data.db.customers[0].fullName, "Alpha");
    assert.equal(b.instance.exportSnapshot().data.db.customers[0].fullName, "Beta");
    const snapshot = plain(a.instance.exportSnapshot());
    await http.call(0, "GET", "/api/customers"); await http.call(0, "GET", "/api/invoices/status");
    assert.deepEqual(plain(a.instance.exportSnapshot()), snapshot);
  } finally { await http.close(); }
});

test("CRM customer GET does not provision rows and global admin cannot escalate scope", async () => {
  const a = runtime("sales", "ws_customer", { roles: { admin: ["customer"] } }), http = await harness([a]);
  try {
    const before = plain(a.instance.exportSnapshot());
    await http.call(0, "GET", "/api/customers/profile"); await http.call(0, "GET", "/api/projects");
    assert.equal((await http.call(0, "POST", "/api/customers", customer("Denied"))).status, 403);
    assert.deepEqual(plain(a.instance.exportSnapshot()), before);
    assert.equal((await http.call(0, "POST", "/api/auth/login", { email: "mona.adel@orgtik.test", password: "fake" })).status, 404);
  } finally { await http.close(); }
});

test("CRM fixture roundtrip preserves all counters/preferences; Nile CRM is independent and empty", () => {
  const a = runtime("sales", "ws_orgtik", { fixtureId: "orgtik-v1" }), nile = runtime("sales", "ws_nile", { fixtureId: "nile-v1" });
  let snapshot;
  try { snapshot = plain(a.instance.exportSnapshot()); assert.ok(snapshot.data.db.projects.length > 0); assert.equal(nile.instance.exportSnapshot().data.db.projects.length, 0); }
  finally { a.close(); nile.close(); }
  snapshot.data.db.projects = []; snapshot.data.db.invoices = []; snapshot.data.profilePrefs = { 1: { language: "ar" } };
  const restored = runtime("sales", "ws_orgtik", { fixtureId: "orgtik-v1", snapshot });
  try { assert.deepEqual(plain(restored.instance.exportSnapshot()), snapshot); }
  finally { restored.close(); }
  for (const patch of [{ workspaceId: "ws_foreign" }, { realm: "foreign" }, { appKey: "hr" }, { sequences: { ...snapshot.sequences, invoice: -1 } }]) assert.throws(() => runtime("sales", "ws_orgtik", { fixtureId: "orgtik-v1", snapshot: { ...snapshot, ...patch } }));
});

test("CRM ordinary reads do not run billing schedules or mutate fixture state", async () => {
  const fixture = runtime("sales", "ws_orgtik", { fixtureId: "orgtik-v1" }), http = await harness([fixture]);
  try {
    const before = plain(fixture.instance.exportSnapshot());
    fixture.now.value += 180 * 864e5;
    for (const route of ["/api/invoices/status", "/api/invoices", "/api/subscriptions", "/api/customers", "/api/loyalty/settings"]) await http.call(0, "GET", route);
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), before);
    assert.equal((await http.call(0, "POST", `/api/admin/staff/${before.data.db.staff[0].id}/access`, { accessMode: "active_now", password: "never-store" })).status, 501);
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), before);
  } finally { await http.close(); }
});

test("CRM ownership transfer preserves customer/person/financial history and replay result", () => {
  const fixture = runtime("sales", "ws_orgtik", { fixtureId: "orgtik-v1" });
  try {
    const before = plain(fixture.instance.exportSnapshot()), command = { fromUserId: 4, target: { kind: "member", userId: 13 }, operationId: "crm-transfer" };
    const result = fixture.instance.transferOwnership(command); assert.ok(result.transferred.length > 0);
    assert.deepEqual(fixture.instance.transferOwnership(command), result);
    const after = plain(fixture.instance.exportSnapshot());
    assert.deepEqual(after.data.db.invoices, before.data.db.invoices); assert.deepEqual(after.data.db.contracts, before.data.db.contracts);
    assert.deepEqual(after.data.db.projects.map(row => row.createdByUserId), before.data.db.projects.map(row => row.createdByUserId));
    assert.throws(() => fixture.instance.transferOwnership({ ...command, target: { kind: "member", userId: 999 } }));
  } finally { fixture.close(); }
});
