const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runtime, harness, plain } = require("../hr/runtime-harness");

test("CRM sequence checks prevent reference reuse even when snapshot copies agree", () => {
  const fixture = runtime("sales", "ws_orgtik", { fixtureId: "orgtik-v1" });
  let snapshot;
  try { snapshot = plain(fixture.instance.exportSnapshot()); }
  finally { fixture.close(); }
  snapshot.sequences.project = 1; snapshot.data.db.counters.project = 1;
  assert.throws(() => runtime("sales", "ws_orgtik", { fixtureId: "orgtik-v1", snapshot }), error => error.code === "workspace_runtime_unavailable");
});

test("CRM explicit archive rejects edits and delayed schedule transitions repeat once", async () => {
  const fixture = runtime("sales", "ws_orgtik", { fixtureId: "orgtik-v1" }), http = await harness([fixture]);
  try {
    fixture.now.value += 90 * 864e5;
    fixture.instance.stageDueTransitions(); const transitioned = plain(fixture.instance.exportSnapshot());
    fixture.instance.stageDueTransitions(); assert.deepEqual(plain(fixture.instance.exportSnapshot()), transitioned);
    const project = transitioned.data.db.projects.find(row => row.ownerUserId === 4 || row.assignedSalesmanId === transitioned.data.db.staff.find(row => row.authUserId === 4)?.id);
    assert.ok(project); fixture.instance.transferOwnership({ fromUserId: 4, target: { kind: "archive" }, operationId: "crm-archive" });
    const snapshot = plain(fixture.instance.exportSnapshot());
    assert.equal(snapshot.data.db.projects.find(row => row.id === project.id).custodyReadOnly, true);
    assert.equal((await http.call(0, "PATCH", `/api/projects/${project.id}`, { projectName: "Should not change" })).status, 403);
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), snapshot);
  } finally { await http.close(); }
});

test("CRM customer in an empty workspace gets explicit missing-profile state rather than implicit creation", async () => {
  const fixture = runtime("sales", "ws_customer", { roles: { admin: ["customer"] } }), http = await harness([fixture]);
  try {
    const before = plain(fixture.instance.exportSnapshot());
    assert.equal((await http.call(0, "GET", "/api/customers/profile")).status, 404);
    const loyalty = await http.call(0, "GET", "/api/loyalty/me"); assert.equal(loyalty.status, 404); assert.equal(loyalty.json.code, "customer_profile_missing");
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), before);
  } finally { await http.close(); }
});
