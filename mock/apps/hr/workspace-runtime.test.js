const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runtime, harness, plain, context } = require("./runtime-harness");

test("HR interleaved empty workspaces have separate departments, counters and people", async () => {
  const a = runtime("hr", "ws_a"), b = runtime("hr", "ws_b"), http = await harness([a, b]);
  try {
    assert.equal(a.instance.bootstrap(context(a, "hr")).state, "empty");
    assert.deepEqual(plain(a.instance.usage().map(row => row.used)), [0, 0, 0]);
    const [one, two] = await Promise.all([http.call(0, "POST", "/api/departments", { name: "A team" }), http.call(1, "POST", "/api/departments", { name: "B team" })]);
    assert.equal(one.status, 201); assert.equal(two.status, 201); assert.equal(one.json.data.id, two.json.data.id);
    assert.equal((await http.call(0, "GET", "/api/departments/1")).json.data.name, "A team");
    assert.equal((await http.call(1, "GET", "/api/departments/1")).json.data.name, "B team");
    assert.equal((await http.call(1, "GET", "/api/employees/10")).status, 404);
    const before = plain(a.instance.exportSnapshot());
    await http.call(0, "GET", "/api/employees"); await http.call(0, "GET", "/api/departments"); await http.call(0, "GET", "/api/settings");
    assert.deepEqual(plain(a.instance.exportSnapshot()), before);
  } finally { await http.close(); }
});

test("HR cold-start snapshots retain deleted highest IDs and all fixture counters", async () => {
  const original = runtime("hr", "ws_orgtik", { fixtureId: "orgtik-v1" });
  let snapshot;
  try {
    snapshot = plain(original.instance.exportSnapshot());
    for (const key of Object.keys(snapshot.sequences).filter(key => !key.startsWith("next"))) snapshot.data[key] = [];
    snapshot.data.sessions = []; snapshot.data.voiceLeaves = [];
  } finally { original.close(); }
  const restored = runtime("hr", "ws_orgtik", { fixtureId: "orgtik-v1", snapshot }), http = await harness([restored]);
  try {
    assert.deepEqual(plain(restored.instance.exportSnapshot()), snapshot);
    const created = await http.call(0, "POST", "/api/departments", { name: "After deletion" });
    assert.equal(created.status, 201); assert.equal(created.json.data.id, snapshot.sequences.departments);
    assert.equal(restored.instance.exportSnapshot().sequences.departments, snapshot.sequences.departments + 1);
  } finally { await http.close(); }
  for (const patch of [{ workspaceId: "ws_foreign" }, { realm: "foreign" }, { appKey: "sales" }, { sequences: { ...snapshot.sequences, employees: 0 } }]) assert.throws(() => runtime("hr", "ws_orgtik", { fixtureId: "orgtik-v1", snapshot: { ...snapshot, ...patch } }));
});

test("HR scoped employee cannot gain HR authority through global admin or userType", async () => {
  const restricted = runtime("hr", "ws_orgtik", { fixtureId: "orgtik-v1", roles: { admin: ["employee"] } }), http = await harness([restricted]);
  try {
    assert.equal((await http.call(0, "POST", "/api/departments", { name: "Forbidden" })).status, 403);
    assert.equal((await http.call(0, "GET", "/api/employees/10")).status, 404);
    assert.deepEqual(plain(restricted.instance.bootstrap(context(restricted, "hr")).employees.map(row => row.id)), [1]);
    assert.equal(restricted.instance.bootstrap(context(restricted, "hr", 1, "no_access")).state, "no_access");
  } finally { await http.close(); }
});

test("HR hiring/offboarding/leave command prerequisites fail without partial business or identity writes", async () => {
  const fixture = runtime("hr", "ws_orgtik", { fixtureId: "orgtik-v1" }), http = await harness([fixture]);
  try {
    const before = plain(fixture.instance.exportSnapshot()), people = plain(fixture.identity.users);
    assert.equal((await http.call(0, "POST", "/api/employees", { firstName: "New", lastName: "Person", email: "new@fixture.test", password: "never-store" })).status, 501);
    assert.equal((await http.call(0, "DELETE", "/api/employees/10")).status, 501);
    const pending = before.data.timeOffs.find(row => row.status === "pending" && row.employeeId !== 1);
    assert.ok(pending);
    assert.equal((await http.call(0, "PATCH", `/api/attendance/time-offs/requests/${pending.id}/decision`, { status: "approved" })).status, 501);
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), before); assert.deepEqual(fixture.identity.users, people);
  } finally { await http.close(); }
});

test("HR ownership transfers preserve creator attribution and replay once", () => {
  const fixture = runtime("hr", "ws_orgtik", { fixtureId: "orgtik-v1" });
  try {
    const before = plain(fixture.instance.exportSnapshot()), command = { fromUserId: 10, target: { kind: "member", userId: 2 }, operationId: "hr-custody" };
    const result = fixture.instance.transferOwnership(command); assert.ok(result.transferred.length > 0);
    assert.deepEqual(fixture.instance.transferOwnership(command), result);
    const after = plain(fixture.instance.exportSnapshot());
    assert.deepEqual(after.data.jobs.map(row => row.createdBy), before.data.jobs.map(row => row.createdBy));
    assert.equal(after.data.jobs.filter(row => Number(row.createdBy) === 10).every(row => row.ownerUserId === 2), true);
    assert.throws(() => fixture.instance.transferOwnership({ ...command, target: { kind: "member", userId: 999 } }));
    fixture.instance.close(); assert.throws(() => fixture.instance.exportSnapshot());
  } finally { fixture.close(); }
});
