const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runtime, harness, plain, context } = require("./runtime-harness");

test("HR shared hire hook excludes credentials and does not independently mutate business state", async () => {
  const commands = [];
  const fixture = runtime("hr", "ws_hire", { lifecycle: { async execute(kind, payload, metadata) { commands.push({ kind, payload: plain(payload), metadata }); return { staged: true }; } } }), http = await harness([fixture]);
  try {
    const before = plain(fixture.instance.exportSnapshot());
    const response = await http.call(0, "POST", "/api/employees", { firstName: "Next", lastName: "Person", email: "next@fixture.test", password: "exclude", passwordHash: "exclude", accessToken: "exclude" }, { "idempotency-key": "hire-next" });
    assert.equal(response.status, 201); assert.equal(commands.length, 1); assert.equal(commands[0].kind, "hr.hire");
    assert.deepEqual(commands[0].payload, { firstName: "Next", lastName: "Person", email: "next@fixture.test" });
    assert.equal(commands[0].metadata.workspaceId, "ws_hire"); assert.equal(commands[0].metadata.operationId, "hire-next");
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), before);
  } finally { await http.close(); }
});

test("HR explicit archive protects hiring custody while preserving creator history", async () => {
  const fixture = runtime("hr", "ws_orgtik", { fixtureId: "orgtik-v1" }), http = await harness([fixture]);
  try {
    const before = plain(fixture.instance.exportSnapshot()), job = before.data.jobs.find(row => Number(row.createdBy) === 10);
    assert.ok(job); fixture.instance.transferOwnership({ fromUserId: 10, target: { kind: "archive" }, operationId: "hr-archive" });
    const archived = fixture.instance.exportSnapshot().data.jobs.find(row => row.id === job.id);
    assert.equal(archived.createdBy, job.createdBy); assert.equal(archived.custodyReadOnly, true);
    const snapshot = plain(fixture.instance.exportSnapshot());
    assert.equal((await http.call(0, "PUT", `/api/recruitment/jobs/${job.id}`, { title: "Should not change" })).status, 403);
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), snapshot);
    fixture.instance.close(); assert.equal((await http.call(0, "GET", "/api/settings")).status, 503);
  } finally { await http.close(); }
});

test("Tool bootstraps cannot promote a person with only hostile global grants", () => {
  for (const [app, tool] of [["hr", "hr"], ["sales", "crm"], ["marketing", "marketing"]]) {
    const fixture = runtime(app, "ws_global_only", { roles: {} });
    try { assert.equal(fixture.instance.bootstrap(context(fixture, tool)).state, "no_access"); }
    finally { fixture.close(); }
  }
});

test("HR committed pending hire stores employment without granting directory or tool access", () => {
  const fixture = runtime("hr", "ws_pending");
  try {
    const person = { id: 99, key: "pending-99", firstName: "Pending", lastName: "Invite", email: "pending@fixture.test" };
    const employee = { id: 99, authUserId: 99, userKey: person.key, firstName: person.firstName, lastName: person.lastName, email: person.email, status: "invited", isActive: false };
    assert.throws(() => fixture.instance.applyCommitted({ kind: "hr.employee.upsert", payload: { employee } }));
    assert.throws(() => fixture.instance.applyCommitted({ kind: "hr.employee.upsert", payload: { employee, person: { ...person, password: "exclude" } } }));
    fixture.instance.applyCommitted({ kind: "hr.employee.upsert", payload: { employee, person } });
    assert.equal(fixture.instance.exportSnapshot().data.employees[0].status, "invited");
    assert.equal(fixture.instance.exportSnapshot().sequences.employees, 100);
    assert.equal(fixture.identity.findUser(99), undefined);
    assert.equal(fixture.instance.bootstrap(context(fixture, "hr", 99)).state, "no_access");
  } finally { fixture.close(); }
});
