const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeStore } = require("../apps/admin/store");
const { initializeWorkspaceAuthority, seatCounts } = require("./workspace-context");
const people = require("./workspace-people");
function fixture() {
  const owner = { id: 1, key: "admin", email: "owner@fixture.test", firstName: "Owner", isActive: true }, colleague = { id: 2, key: "employee", email: "member@fixture.test", firstName: "Member", isActive: true };
  const identity = { users: [owner, colleague], grants: { task_manager: { admin: { roles: ["super_admin"] }, employee: { roles: ["developer"] } } }, findByKey: key => identity.users.find(user => user.key === key), findByEmail: email => identity.users.find(user => user.email.toLowerCase() === email.toLowerCase()) };
  const S = makeStore({ identity }); S.now = () => Date.parse("2026-10-07T09:00:00Z");
  initializeWorkspaceAuthority(S, identity);
  const ws = S.createWorkspace({ wsId: "invites", ownerKey: owner.key, name: "Invitations", email: owner.email });
  ws.members[0].toolGrants = { tasks: { roles: ["super_admin"], assigned: true } };
  ws.lines.push({ id: "paid-tasks", tool: "tasks", planId: "tasks_pro", state: "active", snapshot: { quantity: 2 } });
  return { S, identity, ws, owner, colleague };
}
test("last-seat invitation reserves capacity and competing invitation is refused", () => {
  const f = fixture(); people.invite(f.S, f.identity, f.ws, f.owner, { email: "first@fixture.test", tools: ["tasks"] });
  assert.equal(seatCounts(f.S, f.ws, "tasks").reserved, 1);
  assert.throws(() => people.invite(f.S, f.identity, f.ws, f.owner, { email: "second@fixture.test", tools: ["tasks"] }), { code: "seat_capacity_exhausted" });
});
test("cancel and expiry release reservations and resend cannot overbook", () => {
  const f = fixture(), invite = people.invite(f.S, f.identity, f.ws, f.owner, { email: "first@fixture.test", tools: ["tasks"] });
  people.changeInvitation(f.S, f.ws, f.owner, invite.id, "cancel");
  assert.equal(seatCounts(f.S, f.ws, "tasks").available, 1);
  const expired = people.invite(f.S, f.identity, f.ws, f.owner, { email: "expired@fixture.test", tools: ["tasks"] });
  f.ws.invitations.find(item => item.id === expired.id).expiresAt = "2026-10-06T09:00:00Z";
  people.invite(f.S, f.identity, f.ws, f.owner, { email: "winner@fixture.test", tools: ["tasks"] });
  assert.throws(() => people.changeInvitation(f.S, f.ws, f.owner, expired.id, "resend"), { code: "seat_capacity_exhausted" });
});
test("acceptance converts a reservation once and never resets an existing password", () => {
  const f = fixture(); f.colleague.passwordHash = "preserved";
  people.invite(f.S, f.identity, f.ws, f.owner, { email: f.colleague.email, tools: ["tasks"] });
  const token = f.S.db.mailbox.at(-1).acceptanceToken;
  assert.throws(() => people.acceptInvitation(f.S, f.identity, token, null, { password: "different" }), { code: "recipient_sign_in_required" });
  const first = people.acceptInvitation(f.S, f.identity, token, f.colleague, { password: "different" });
  const repeat = people.acceptInvitation(f.S, f.identity, token, f.colleague, {});
  assert.equal(first.replayed, false); assert.equal(repeat.replayed, true);
  assert.equal(f.colleague.passwordHash, "preserved");
  assert.deepEqual(seatCounts(f.S, f.ws, "tasks"), { capacity: 2, assigned: 2, reserved: 0, available: 0 });
});
test("new recipient acceptance creates one identity and one scoped membership", () => {
  const f = fixture(); people.invite(f.S, f.identity, f.ws, f.owner, { email: "new@fixture.test", tools: ["tasks"] });
  const token = f.S.db.mailbox.at(-1).acceptanceToken, before = f.identity.users.length;
  const result = people.acceptInvitation(f.S, f.identity, token, null, { name: "New Member", password: "StrongFixture!" });
  assert.equal(Number.isSafeInteger(result.userId) && result.userId > 0 && result.userId < 2 ** 48, true);
  assert.equal(f.identity.users.length, before + 1);
  const created = f.identity.users.find(user => user.id === result.userId);
  assert.ok(created.passwordHash); assert.equal(created.password, undefined);
  assert.equal(f.ws.members.filter(member => member.userKey === created.key && member.status === "active").length, 1);
  assert.equal(f.S.workspace("ws_orgtik").members.some(member => member.userKey === created.key), false);
});
test("ownership transfer changes platform authority without manufacturing tool seats", () => {
  const f = fixture(); f.ws.members.push({ id: "target", userKey: f.colleague.key, role: "member", status: "active", revision: 1, toolGrants: {} });
  people.transferOwnership(f.S, f.ws, f.owner, "target");
  assert.equal(f.ws.members[0].role, "admin"); assert.equal(f.ws.members[1].role, "owner");
  assert.deepEqual(f.ws.members[1].toolGrants, {});
});
