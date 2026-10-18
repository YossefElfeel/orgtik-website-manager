const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runtime, harness, plain } = require("../hr/runtime-harness");

test("Marketing workspace-zone schedule parsing and analytics remain pure across DST", async () => {
  const fixture = runtime("marketing", "ws_dst", { timeZone: "Europe/Zurich", now: "2026-03-29T00:30:00Z" }), http = await harness([fixture]);
  try {
    const project = await http.call(0, "POST", "/projects", { name: "DST brand" }); assert.equal(project.status, 201);
    const response = await http.call(0, "POST", "/publishing/posts", { projectId: project.json.data.id, title: "Clock boundary", status: "DRAFT", scheduledAt: "2026-03-30T10:00", targets: [{ platform: "FACEBOOK" }] }); assert.equal(response.status, 201);
    const snapshot = plain(fixture.instance.exportSnapshot());
    assert.equal(snapshot.data.posts[0].scheduledAt, "2026-03-30T08:00:00.000Z");
    assert.equal((await http.call(0, "GET", "/analytics/reports/overview")).status, 200);
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), snapshot);
  } finally { await http.close(); }
});

test("Marketing asset references are project scoped and archived authors retain attribution", async () => {
  const fixture = runtime("marketing", "ws_orgtik", { fixtureId: "orgtik-v1" }), http = await harness([fixture]);
  try {
    const before = plain(fixture.instance.exportSnapshot()), nile = before.data.projects.find(row => row.key === "nile"), foreign = before.data.gallery.find(row => row.projectId !== nile.id);
    const created = await http.call(0, "POST", "/publishing/posts", { projectId: nile.id, title: "Reference boundary", status: "DRAFT", targets: [{ platform: "FACEBOOK", galleryIds: [foreign.id] }] }); assert.equal(created.status, 201);
    assert.deepEqual(plain(fixture.instance.exportSnapshot().data.posts.find(row => row.id === created.json.data.id).targets[0].galleryIds), []);
    fixture.instance.transferOwnership({ fromUserId: 14, target: { kind: "archive" }, operationId: "archive-writer" });
    const snapshot = plain(fixture.instance.exportSnapshot()), post = snapshot.data.posts.find(row => row.userId === 14);
    assert.ok(post); assert.equal(post.custodyReadOnly, true);
    assert.equal((await http.call(0, "PATCH", `/publishing/posts/${post.id}`, { title: "Should not change" })).status, 403);
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), snapshot);
  } finally { await http.close(); }
});

test("Marketing simulated callback is an explicit POST command; GET cannot consume authorization state", async () => {
  const fixture = runtime("marketing", "ws_orgtik", { fixtureId: "orgtik-v1" }), http = await harness([fixture]);
  try {
    const before = plain(fixture.instance.exportSnapshot());
    assert.equal((await http.call(0, "GET", "/integrations/FACEBOOK/callback?state=bad&code=bad")).status, 405);
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), before);
    const connect = await http.call(0, "POST", "/integrations/FACEBOOK/connect", {}); assert.equal(connect.status, 200);
    const url = new URL(connect.json.data.authUrl), state = url.searchParams.get("state"), code = url.searchParams.get("code");
    const snapshot = plain(fixture.instance.exportSnapshot());
    assert.equal((await http.call(0, "GET", `/integrations/FACEBOOK/callback?state=${state}&code=${code}`)).status, 405);
    assert.deepEqual(plain(fixture.instance.exportSnapshot()), snapshot);
    assert.equal((await http.call(0, "POST", "/integrations/FACEBOOK/callback", { state, code })).status, 200);
    assert.equal((await http.call(0, "POST", "/integrations/FACEBOOK/callback", { state, code })).status, 400);
    assert.equal(Object.keys(fixture.instance.exportSnapshot().data.tempIntegrations).length, 1);
  } finally { await http.close(); }
});
