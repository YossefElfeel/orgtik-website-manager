const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runtime, harness, plain, context } = require("../hr/runtime-harness");

test("Marketing empty workspaces interleave independent brands and reject foreign IDs", async () => {
  const a = runtime("marketing", "ws_a"), b = runtime("marketing", "ws_b"), http = await harness([a, b]);
  try {
    assert.equal(a.instance.bootstrap(context(a, "marketing")).state, "empty");
    assert.equal(a.instance.exportSnapshot().data.gallery.length, 0);
    const [one, two] = await Promise.all([http.call(0, "POST", "/projects", { name: "Alpha" }), http.call(1, "POST", "/projects", { name: "Beta" })]);
    assert.equal(one.status, 201); assert.equal(two.status, 201);
    assert.equal((await http.call(1, "GET", `/projects/${one.json.data.id}`)).status, 404);
    assert.equal((await http.call(1, "POST", "/labels", { projectId: one.json.data.id, name: "Foreign label" })).status, 404);
    assert.equal(a.instance.exportSnapshot().data.projects[0].name, "Alpha"); assert.equal(b.instance.exportSnapshot().data.projects[0].name, "Beta");
  } finally { await http.close(); }
});

test("Marketing fixture/cold start retain all state and removed gallery ID allocator", () => {
  const org = runtime("marketing", "ws_orgtik", { fixtureId: "orgtik-v1" }), nile = runtime("marketing", "ws_nile", { fixtureId: "nile-v1" });
  let snapshot;
  try {
    snapshot = plain(org.instance.exportSnapshot()); const scoped = nile.instance.exportSnapshot();
    assert.equal(scoped.data.projects.length, 1); assert.equal(scoped.data.projects[0].key, "nile");
    const projectId = scoped.data.projects[0].id;
    for (const key of ["posts", "campaigns", "gallery", "integrations", "audiences"]) assert.ok(scoped.data[key].every(row => row.projectId === projectId));
    assert.deepEqual(plain(scoped.data.projects[0].memberUserIds), [5]); assert.ok(scoped.data.posts.length > 0);
    snapshot.data.gallery = [];
  } finally { org.close(); nile.close(); }
  const restored = runtime("marketing", "ws_orgtik", { fixtureId: "orgtik-v1", snapshot });
  try { assert.deepEqual(plain(restored.instance.exportSnapshot()), snapshot); assert.ok(snapshot.sequences.nextGalleryId > 1); }
  finally { restored.close(); }
  for (const patch of [{ workspaceId: "foreign" }, { realm: "foreign" }, { appKey: "sales" }, { sequences: { nextGalleryId: 0 } }]) assert.throws(() => runtime("marketing", "ws_orgtik", { fixtureId: "orgtik-v1", snapshot: { ...snapshot, ...patch } }));
});

test("Marketing reviewer/global admin sees only authorized project and media; GETs stay pure", async () => {
  const fixture = runtime("marketing", "ws_orgtik", { fixtureId: "orgtik-v1", roles: { admin: ["client_reviewer"] } });
  // Admit this reviewer to only Nile, without granting broad tool roles.
  const snapshot = plain(fixture.instance.exportSnapshot()); snapshot.data.projects.forEach(row => { row.memberUserIds = row.key === "nile" ? [1] : []; }); fixture.instance.applyCommitted({ snapshot });
  const http = await harness([fixture]);
  try {
    const before = plain(fixture.instance.exportSnapshot()), own = before.data.projects.find(row => row.key === "nile"), foreign = before.data.projects.find(row => row.key === "orgtik");
    const media = before.data.gallery.find(row => row.projectId === foreign.id);
    assert.deepEqual(plain(fixture.instance.bootstrap(context(fixture, "marketing")).projects.map(row => row.id)), [own.id]);
    assert.equal((await http.call(0, "POST", "/projects", { name: "Denied" })).status, 403);
    assert.equal((await http.call(0, "GET", `/galleries/${media.id}`)).status, 404);
    assert.equal((await http.call(0, "POST", "/galleries/bulk-fetch", { ids: [media.id] })).json.data.length, 0);
    assert.equal((await http.call(0, "GET", `/publishing/posts?projectId=${foreign.id}`)).status, 404);
    fixture.now.value += 180 * 864e5;
    for (const route of ["/projects", "/projects/active", "/publishing/posts", "/campaigns"]) assert.equal((await http.call(0, "GET", route)).status, 200);
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), before);
    assert.equal((await http.call(0, "POST", "/__reset", {})).status, 404);
  } finally { await http.close(); }
});

test("Marketing explicit calendar transition replays idempotently outside GET; custody keeps authors", () => {
  const fixture = runtime("marketing", "ws_orgtik", { fixtureId: "orgtik-v1" });
  try {
    const before = plain(fixture.instance.exportSnapshot()); fixture.now.value += 180 * 864e5;
    fixture.instance.transitionCalendar(); const transitioned = plain(fixture.instance.exportSnapshot());
    assert.notDeepEqual(transitioned, before); fixture.instance.transitionCalendar(); assert.deepEqual(plain(fixture.instance.exportSnapshot()), transitioned);
    const command = { fromUserId: 14, target: { kind: "member", userId: 12 }, operationId: "marketing-custody" };
    const result = fixture.instance.transferOwnership(command); assert.ok(result.transferred.length > 0); assert.deepEqual(fixture.instance.transferOwnership(command), result);
    const after = plain(fixture.instance.exportSnapshot()); assert.deepEqual(after.data.posts.map(row => row.userId), before.data.posts.map(row => row.userId));
    assert.throws(() => fixture.instance.transferOwnership({ ...command, target: { kind: "member", userId: 999 } }));
  } finally { fixture.close(); }
});

test("Marketing calendar uses workspace timezone and calendar days across Zurich DST", () => {
  const fixture = runtime("marketing", "ws_dst", { now: "2026-03-29T01:30:00Z", timeZone: "Europe/Zurich" });
  try {
    const clock = fixture.input.clock, start = clock.dayStart(), next = clock.addCalendarDays(start, 1);
    assert.equal(next - start, 23 * 36e5);
    assert.equal(clock.parts(start).hour, 0); assert.equal(clock.parts(next).hour, 0);
    const source = fixture.graph.load(); assert.equal(typeof source.createWorkspaceRuntime, "function");
    const instance = fixture.instance; assert.equal(instance.bootstrap(context(fixture, "marketing")).state, "empty");
  } finally { fixture.close(); }
});
