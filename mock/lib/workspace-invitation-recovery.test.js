const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeStore } = require('../apps/admin/store');
const { initializeWorkspaceAuthority, seatCounts } = require('./workspace-context');
const people = require('./workspace-people');
function fixture() {
  const users = [{ id: 1, key: 'admin', email: 'owner@fixture.test', firstName: 'Owner', isActive: true }, { id: 2, key: 'employee', email: 'member@fixture.test', firstName: 'Member', isActive: true }];
  const identity = { users, grants: {}, findByKey: key => users.find(user => user.key === key), findByEmail: email => users.find(user => user.email === email) };
  const S = makeStore({ identity }); S.now = () => Date.parse('2026-10-07T09:00:00Z'); initializeWorkspaceAuthority(S, identity);
  const ws = S.createWorkspace({ wsId: 'invite-recovery', ownerKey: 'admin', name: 'Recovery', email: users[0].email });
  ws.lines.push({ tool: 'tasks', planId: 'tasks_pro', state: 'active', snapshot: { quantity: 2 } }, { tool: 'files', planId: 'files_pro', state: 'active', snapshot: { quantity: 1 } }, { tool: 'hr', planId: 'hr_pro', state: 'active', snapshot: { quantity: 2 } });
  ws.members[0].toolGrants = { tasks: { roles: ['super_admin'], assigned: true } };
  return { S, identity, ws, owner: users[0], member: users[1] };
}
test('Lost invitation result recovers one reservation and one mailbox message using its original scoped attempt', () => {
  const f = fixture(), body = { email: 'invited@test.invalid', role: 'guest', tools: ['tasks'] }, options = { operationId: 'unique-invite-attempt' };
  const first = people.invite(f.S, f.identity, f.ws, f.owner, body, options);
  const quantity = f.ws.lines[0].snapshot.quantity;
  const second = people.invite(f.S, f.identity, f.ws, f.owner, body, options);
  assert.deepEqual(second, first); assert.equal(f.ws.invitations.length, 1); assert.equal(f.S.db.mailbox.filter(row => row.invitationId === first.id).length, 1);
  assert.equal(seatCounts(f.S, f.ws, 'tasks').reserved, 1); assert.equal(f.ws.lines[0].snapshot.quantity, quantity);
  assert.throws(() => people.invite(f.S, f.identity, f.ws, f.owner, { ...body, email: 'changed@test.invalid' }, options), { code: 'operation_conflict' });
  f.ws.members[0].role = 'member';
  assert.throws(() => people.invite(f.S, f.identity, f.ws, f.owner, body, options), { code: 'workspace_admin_required' });
});
test('Null tool selection is frozen to currently subscribed supported tools and excludes guest HR', () => {
  const f = fixture();
  const invited = people.invite(f.S, f.identity, f.ws, f.owner, { email: 'guest@test.invalid', role: 'guest', tools: null }, { operationId: 'all-current' });
  assert.deepEqual(invited.tools.sort(), ['files', 'tasks']);
  f.ws.lines.push({ tool: 'chat', planId: 'chat_pro', state: 'active', snapshot: { quantity: 1 } });
  const repeat = people.invite(f.S, f.identity, f.ws, f.owner, { email: 'guest@test.invalid', role: 'guest', tools: null }, { operationId: 'all-current' });
  assert.deepEqual(repeat.tools.sort(), ['files', 'tasks']); assert.equal(f.ws.invitations[0].grants.chat, undefined);
});
test('Only owner appoints administrators, including invitation creation; pending members cannot have access edited', () => {
  const f = fixture(); f.ws.members[0].role = 'admin';
  assert.throws(() => people.invite(f.S, f.identity, f.ws, f.owner, { email: 'admin@test.invalid', role: 'admin', tools: [] }), { code: 'owner_required' });
  f.ws.members[0].role = 'owner'; const invitation = people.invite(f.S, f.identity, f.ws, f.owner, { email: 'pending@test.invalid', tools: ['tasks'] });
  assert.throws(() => people.changeMember(f.S, f.ws, f.owner, f.ws.members.find(row => row.invitationId === invitation.id).id, { tools: null }), { code: 'member_inactive' });
});
test('Accepting a pending tool-access invitation cannot restore transferred ownership', () => {
  const f = fixture();
  f.ws.members.push({ id: 'successor', userKey: f.member.key, role: 'member', status: 'active', revision: 1, toolGrants: {} });
  people.invite(f.S, f.identity, f.ws, f.owner, { email: f.owner.email, tools: ['hr'], role: 'member' }, { authorizedHire: true });
  const token = f.S.db.mailbox.at(-1).acceptanceToken;
  people.transferOwnership(f.S, f.ws, f.owner, 'successor');
  people.acceptInvitation(f.S, f.identity, token, f.owner, {});
  assert.equal(f.ws.members[0].role, 'admin'); assert.equal(f.ws.members.filter(member => member.role === 'owner').length, 1);
  assert.equal(f.ws.members[0].toolGrants.hr.assigned, true);
});
test('Repeating an uncertain resend uses one rotated token and one mock notification, while cancel releases the reservation once', () => {
  const f = fixture(), invitation = people.invite(f.S, f.identity, f.ws, f.owner, { email: 'recover@test.invalid', tools: ['tasks'] });
  const first = people.changeInvitation(f.S, f.ws, f.owner, invitation.id, 'resend', { operationId: 'resend-once' });
  const version = f.ws.invitations[0].version, messages = f.S.db.mailbox.length;
  assert.deepEqual(people.changeInvitation(f.S, f.ws, f.owner, invitation.id, 'resend', { operationId: 'resend-once' }), first);
  assert.equal(f.ws.invitations[0].version, version); assert.equal(f.S.db.mailbox.length, messages);
  people.changeInvitation(f.S, f.ws, f.owner, invitation.id, 'cancel', { operationId: 'cancel-once' });
  people.changeInvitation(f.S, f.ws, f.owner, invitation.id, 'cancel', { operationId: 'cancel-once' });
  assert.equal(seatCounts(f.S, f.ws, 'tasks').reserved, 0);
});
