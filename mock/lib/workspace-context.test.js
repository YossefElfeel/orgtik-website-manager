const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveWorkspaceContext, createTenantIdentityFacade, seatCounts, assignInitialOwnerSeats } = require("./workspace-context");
const { createStore, seeded } = require("./util");

function fixture() {
  const users = [{ id: 1, key: "owner", userType: "admin", firstName: "Owner", email: "owner@test.invalid" }, { id: 2, key: "member", userType: "admin", firstName: "Member", email: "member@test.invalid" }, { id: 3, key: "other", firstName: "Other", email: "other@test.invalid" }];
  const identity = { users, grants: { global: { member: { roles: ["super_admin"] } } }, scopes: [{ name: "global" }, { name: "task_manager" }], findUser: id => users.find(user => user.id === id) };
  const member = (key, role, assigned = true) => ({ id: key, userKey: key, role, status: "active", revision: 1, toolGrants: { tasks: { roles: [role === "owner" ? "super_admin" : "developer"], assigned } } });
  const line = (tool = "tasks", state = "active") => ({ id: `line-${tool}`, tool, state, planId: tool, snapshot: { quantity: 2 } });
  const a = { id: "a", name: "A", state: "active", members: [member("owner", "owner"), member("member", "member")], lines: [line()], invitations: [], authorityRevision: 1 };
  const b = { id: "b", name: "B", state: "active", members: [member("other", "owner")], lines: [line()], invitations: [], authorityRevision: 1 };
  const S = { db: { plans: [{ id: "tasks", perUser: true }, { id: "files", perUser: false }], workspaces: [a, b] }, now: () => Date.parse("2026-10-07T09:00:00Z"), workspace: id => [a, b].find(workspace => workspace.id === id) };
  return { users, identity, S, a, b, line };
}

test("workspace binding denies another tenant and never falls back", () => {
  const f = fixture();
  assert.throws(() => resolveWorkspaceContext(f.S, f.identity, f.users[1], { workspaceId: "b" }), { code: "workspace_access_revoked" });
  assert.throws(() => resolveWorkspaceContext(f.S, f.identity, f.users[1], { workspaceId: "a", headerWorkspace: "b" }), { code: "workspace_mismatch" });
  assert.throws(() => resolveWorkspaceContext(f.S, f.identity, f.users[1]), { code: "workspace_required" });
});

test("global identity admin claims cannot promote a local member", () => {
  const f = fixture(), context = resolveWorkspaceContext(f.S, f.identity, f.users[1], { workspaceId: "a" });
  assert.deepEqual(context.tools.tasks.roles, ["developer"]);
  const facade = createTenantIdentityFacade({ ...f, realm: "test", workspaceId: "a", appKey: "tasks", currentPrincipal: () => ({ workspaceContext: context }) });
  assert.equal(facade.findByKey("member").userType, "employee");
  assert.equal(facade.grants.global, undefined);
  assert.equal(facade.findUser(3), null);
  assert.deepEqual(facade.users.map(user => user.id), [1, 2]);
});

test("ownership never bypasses an assigned seat", () => {
  const f = fixture(); f.a.members[0].toolGrants.tasks.assigned = false;
  const context = resolveWorkspaceContext(f.S, f.identity, f.users[0], { workspaceId: "a" });
  assert.equal(context.tools.tasks.access, "no_access");
  assert.throws(() => resolveWorkspaceContext(f.S, f.identity, f.users[0], { workspaceId: "a", audience: "tool:tasks" }), { status: 403 });
});

test("billing grace remains writable and only its read-only line stops writes", () => {
  const f = fixture(); f.a.lines[0].state = "past_due"; f.a.state = "past_due";
  assert.equal(resolveWorkspaceContext(f.S, f.identity, f.users[0], { workspaceId: "a" }).tools.tasks.canWrite, true);
  f.a.lines[0].state = "read_only";
  const context = resolveWorkspaceContext(f.S, f.identity, f.users[0], { workspaceId: "a" });
  assert.equal(context.tools.tasks.access, "read_only"); assert.equal(context.tools.tasks.canWrite, false);
});

test("expired reservations do not consume capacity; first purchase assigns owner once", () => {
  const f = fixture(); f.a.members[0].toolGrants.tasks.assigned = false;
  f.a.invitations = [{ status: "pending", expiresAt: "2026-10-06T09:00:00Z", reservations: ["tasks"] }];
  assert.deepEqual(seatCounts(f.S, f.a, "tasks"), { capacity: 2, assigned: 1, reserved: 0, available: 1 });
  delete f.a.members[0].toolGrants.tasks;
  assignInitialOwnerSeats(f.S); assignInitialOwnerSeats(f.S);
  assert.equal(seatCounts(f.S, f.a, "tasks").assigned, 2);
  // Transferring ownership of this existing purchase cannot manufacture another grant.
  f.a.members[1].toolGrants.tasks.assigned = false; f.a.members[1].role = "owner"; f.a.members[0].role = "member";
  assignInitialOwnerSeats(f.S);
  assert.equal(f.a.members[1].toolGrants.tasks.assigned, false);
});

test("counter and RNG snapshots preserve deleted-highest-ID and next values", () => {
  const store = createStore([{ id: 1 }]);
  const removed = store.insert({ name: "removed" }); store.remove(removed.id);
  const restored = createStore().importSnapshot(store.exportSnapshot());
  assert.equal(restored.insert({}).id, 3);
  assert.throws(() => restored.importSnapshot({ rows: [{ id: 99 }], idKey: "id", nextId: 2 }), /reuse/);
  const rng = seeded(43); rng.rnd(); const state = rng.exportState(), expected = rng.rnd();
  const replay = seeded(); replay.importState(state); assert.equal(replay.rnd(), expected);
});
