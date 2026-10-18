const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeStore } = require('../apps/admin/store');
const { initializeWorkspaceAuthority, seatCounts } = require('./workspace-context');
const people = require('./workspace-people');
const journeys = require('./workspace-people-journeys');
function fixture() {
  const owner = { id: 1, key: 'admin', email: 'owner@journey.test', firstName: 'Owner', isActive: true }, existing = { id: 2, key: 'employee', email: 'member@journey.test', firstName: 'Existing', isActive: true, passwordHash: 'unchanged' };
  const identity = { users: [owner, existing], grants: {}, findByEmail: email => identity.users.find(row => row.email === email), findByKey: key => identity.users.find(row => row.key === key) };
  const S = makeStore({ identity }); S.now = () => Date.parse('2026-10-07T09:00:00Z'); initializeWorkspaceAuthority(S, identity);
  const ws = S.createWorkspace({ wsId: 'journeys', ownerKey: owner.key, name: 'Journey workspace', email: owner.email });
  ws.lines.push({ tool: 'tasks', planId: 'tasks_pro', state: 'active', snapshot: { quantity: 2 } });
  ws.members[0].toolGrants = { tasks: { roles: ['super_admin'], assigned: true } };
  return { S, identity, ws, owner, existing };
}
test('mock sender delivery is limited to current administrators and current pending token', () => {
  const f = fixture(), invitation = people.invite(f.S, f.identity, f.ws, f.owner, { email: f.existing.email, tools: ['tasks'] });
  assert.match(journeys.delivery(f.S, f.ws, f.owner, invitation.id).invitePath, /^\/invite\/[\w-]{43}$/);
  assert.throws(() => journeys.delivery(f.S, f.ws, f.existing, invitation.id), { code: 'workspace_admin_required' });
  assert.throws(() => journeys.delivery(f.S, f.ws, f.owner, invitation.id, { readOnly: true }), { code: 'impersonation_read_only' });
  people.changeInvitation(f.S, f.ws, f.owner, invitation.id, 'cancel');
  assert.throws(() => journeys.delivery(f.S, f.ws, f.owner, invitation.id), { code: 'invitation_unavailable' });
});
test('recipient inbox hides old resend tokens and unrelated recipients without modifying business state', () => {
  const f = fixture(), invitation = people.invite(f.S, f.identity, f.ws, f.owner, { email: f.existing.email, tools: ['tasks'] });
  people.changeInvitation(f.S, f.ws, f.owner, invitation.id, 'resend');
  const before = JSON.stringify(f.S.db), inbox = journeys.mailbox(f.S, f.existing);
  assert.equal(inbox.length, 2); assert.equal(inbox[0].invitationStatus, 'superseded'); assert.equal(inbox[0].invitePath, undefined);
  assert.equal(inbox[1].invitationStatus, 'pending'); assert.ok(inbox[1].invitePath); assert.equal(inbox[1].acceptanceToken, undefined);
  assert.deepEqual(journeys.mailbox(f.S, f.owner), []);
  assert.throws(() => journeys.mailbox(f.S, f.existing, { readOnly: true }), { code: 'impersonation_read_only' });
  assert.equal(JSON.stringify(f.S.db), before);
});
test('metadata guides existing, pending and new recipients without changing account credentials', () => {
  const f = fixture();
  people.invite(f.S, f.identity, f.ws, f.owner, { email: f.existing.email, tools: [] });
  const token = f.S.db.mailbox.at(-1).acceptanceToken;
  assert.equal(journeys.metadata(f.S, f.identity, token).requiresSignIn, true);
  f.existing.isActive = false; assert.equal(journeys.metadata(f.S, f.identity, token).recipientState, 'inactive');
  f.existing.pendingActivation = true; assert.equal(journeys.metadata(f.S, f.identity, token).recipientState, 'pending_activation');
  assert.equal(f.existing.passwordHash, 'unchanged');
});
test('accepted business receipt never stores password or session material and consumes a reservation once', () => {
  const f = fixture(); people.invite(f.S, f.identity, f.ws, f.owner, { email: f.existing.email, tools: ['tasks'] });
  const token = f.S.db.mailbox.at(-1).acceptanceToken;
  assert.throws(() => journeys.accept(f.S, f.identity, token, null, { password: 'IgnoredPassword!' }, 'accept-one'), { code: 'recipient_sign_in_required' });
  const first = journeys.accept(f.S, f.identity, token, f.existing, { password: 'IgnoredPassword!' }, 'accept-one');
  const repeated = journeys.accept(f.S, f.identity, token, f.existing, {}, 'accept-one');
  assert.equal(first.userId, repeated.userId); assert.equal(repeated.replayed, true); assert.equal(f.existing.passwordHash, 'unchanged');
  assert.equal(seatCounts(f.S, f.ws, 'tasks').assigned, 2); assert.equal(seatCounts(f.S, f.ws, 'tasks').reserved, 0);
  assert.equal(JSON.stringify(f.ws.acceptanceOperations).includes('IgnoredPassword'), false);
});
test('an exact ownership receipt can be confirmed by the original active admin without granting a new transfer', () => {
  const f = fixture(); f.ws.members.push({ id: 'successor', userKey: f.existing.key, status: 'active', role: 'member', revision: 1, toolGrants: {} });
  const result = journeys.transfer(f.S, f.identity, f.ws, f.owner, 'successor', 'transfer-one');
  assert.deepEqual(journeys.transfer(f.S, f.identity, f.ws, f.owner, 'successor', 'transfer-one'), result);
  assert.throws(() => journeys.transfer(f.S, f.identity, f.ws, f.owner, 'successor', 'new-transfer'), { code: 'owner_required' });
  f.ws.members[0].status = 'removed';
  assert.throws(() => journeys.transfer(f.S, f.identity, f.ws, f.owner, 'successor', 'transfer-one'), { code: 'workspace_admin_required' });
  assert.deepEqual(f.ws.members[1].toolGrants, {});
});
test('an active membership with a deactivated account cannot receive new workspace ownership', () => {
  const f = fixture(); f.ws.members.push({ id: 'successor', userKey: f.existing.key, status: 'active', role: 'member', revision: 1, toolGrants: {} });
  f.existing.isActive = false;
  assert.throws(() => journeys.transfer(f.S, f.identity, f.ws, f.owner, 'successor', 'new-transfer'), { code: 'invalid_owner' });
  assert.equal(f.ws.members[0].role, 'owner');
});
