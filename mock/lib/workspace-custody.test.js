const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hasActiveAccount, eligible, coverage, ROLES } = require('./workspace-custody');

test('custody eligibility requires a canonical active account as well as the current tool grant', () => {
  const person = { key: 'successor', isActive: true };
  const identity = { findByKey: key => key === person.key ? person : undefined };
  const member = { id: 'successor-member', userKey: person.key, status: 'active', role: 'member', toolGrants: Object.fromEntries(Object.entries(ROLES).map(([tool, roles]) => [tool, { assigned: true, roles: [roles[0]] }])) };
  for (const tool of Object.keys(ROLES)) assert.equal(eligible(member, tool, identity), true);
  person.isActive = false;
  for (const tool of Object.keys(ROLES)) assert.equal(eligible(member, tool, identity), false);
  person.isActive = true; person.deletedAt = '2026-10-07T09:00:00Z';
  assert.equal(hasActiveAccount(member, identity), false);
  delete person.deletedAt; person.pendingActivation = true;
  assert.equal(hasActiveAccount(member, identity), false);
  delete person.pendingActivation;
  delete person.isActive; assert.equal(hasActiveAccount(member, identity), false); person.isActive = true;
  assert.equal(eligible(member, 'tasks', { findByKey: () => undefined }), false);
  assert.equal(eligible(member, 'tasks'), false);
  member.role = 'guest'; assert.equal(eligible(member, 'tasks', identity), false);
});

test('custody coverage omits unavailable accounts without removing the archive option', () => {
  const owner = { id: 'departing', toolGrants: { files: { assigned: true } } };
  const members = ['available', 'inactive', 'deleted', 'missing'].map(key => ({ id: key, userKey: key, status: 'active', role: 'member', toolGrants: { files: { assigned: true, roles: ['file_editor'] } } }));
  const users = [{ key: 'available', isActive: true }, { key: 'inactive', isActive: false }, { key: 'deleted', isActive: true, deletedAt: '2026-10-07T09:00:00Z' }];
  const identity = { findByKey: key => users.find(user => user.key === key) };
  const files = coverage({ members: [owner, ...members] }, owner, identity).find(row => row.tool === 'files');
  assert.deepEqual(files, { tool: 'files', assigned: true, eligibleSuccessorMemberIds: ['available'], canArchive: true });
});
