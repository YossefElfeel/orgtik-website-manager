const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const commands = require('./workspace-commands'), people = require('./workspace-people');
const { resolveWorkspaceContext, createTenantIdentityFacade, assignInitialOwnerSeats } = require('./workspace-context');
function fixture() {
  const users = [{ id: 1, key: 'actor', firstName: 'One', lastName: 'Owner', email: 'one@test.invalid', isActive: true, passwordHash: 'preserved-credential', profile: {} }, { id: 2, key: 'target', email: 'two@test.invalid', isActive: true }];
  const members = [{ id: 'owner', userKey: 'actor', role: 'owner', status: 'active', revision: 1, toolGrants: { tasks: { roles: ['super_admin'], assigned: true } } }, { id: 'target', userKey: 'target', role: 'member', status: 'active', revision: 1, toolGrants: { tasks: { roles: ['developer'], assigned: true }, files: { roles: ['file_editor'], assigned: true } } }];
  const workspace = { id: 'selected', state: 'active', members, invitations: [], authorityRevision: 1, lines: [{ id: 'tasks-line', tool: 'tasks', planId: 'tasks', state: 'active', snapshot: { quantity: 3 } }] };
  const other = { id: 'other', state: 'active', members: [{ userKey: 'target', role: 'owner', status: 'active', toolGrants: { tasks: { roles: ['super_admin'], assigned: true } } }], lines: [] };
  const S = { db: { plans: [{ id: 'tasks', perUser: true }, { id: 'chat', perUser: false }], workspaces: [workspace, other] }, workspace: id => [workspace, other].find(row => row.id === id), now: () => Date.parse('2026-10-07T09:00:00Z'), iso: value => new Date(value).toISOString(), log() {} };
  const identity = { users, scopes: [{ name: 'task_manager' }], findUser: id => users.find(row => row.id === Number(id)), publicUser: user => { const { passwordHash, ...safe } = user; return safe; } };
  const principal = { user: users[0], actor: users[0], readOnly: false, context: { workspaceContext: resolveWorkspaceContext(S, identity, users[0], { workspaceId: workspace.id }), scopes: [] } };
  return { S, identity, workspace, other, principal, tool: 'tasks' };
}
test('Guests cannot receive admin/owner overrides through invitation or role mutation', () => {
  for (const [tool, role] of [['tasks', 'super_admin'], ['files', 'super_admin'], ['chat', 'owner'], ['marketing', 'super_admin'], ['crm', 'admin']]) assert.throws(() => people.grantsFor([tool], 'guest', { [tool]: role }), { code: 'unsupported_guest_role' });
  assert.deepEqual(people.grantsFor(['tasks', 'files', 'chat'], 'guest'), { tasks: { roles: ['viewer'], assigned: false }, files: { roles: ['file_guest'], assigned: false }, chat: { roles: ['guest'], assigned: false } });
  const f = fixture(); f.workspace.members[1].role = 'guest'; f.workspace.members[1].toolGrants.tasks.roles = ['viewer'];
  assert.throws(() => commands.execute({ ...f, kind: 'workspace.tool.roles', payload: { tool: 'tasks', userId: 2, roles: ['super_admin'] } }), { code: 'unsupported_guest_role' });
  assert.deepEqual(f.workspace.members[1].toolGrants.tasks.roles, ['viewer']);
});
test('An unsafe historical guest grant is capped consistently in context and facade', () => {
  const f = fixture(); f.workspace.members[1].role = 'guest'; f.workspace.members[1].toolGrants.tasks.roles = ['super_admin', 'viewer'];
  const context = resolveWorkspaceContext(f.S, f.identity, f.identity.users[1], { workspaceId: f.workspace.id });
  assert.deepEqual(context.tools.tasks.roles, ['viewer']); assert.equal(context.tools.tasks.canWrite, false);
  const facade = createTenantIdentityFacade({ ...f, realm: 'test', workspaceId: f.workspace.id, appKey: 'tasks', currentPrincipal: () => ({ workspaceContext: context }) });
  assert.deepEqual(facade.userScopes(facade.findUser(2))[0].roles, ['viewer']); assert.equal(facade.findUser(2).userType, 'customer');
});
test('Current role and assignment are checked before a committed-command receipt can be reused', () => {
  const f = fixture(), args = { ...f, kind: 'workspace.tool.roles', payload: { tool: 'tasks', userId: 2, roles: ['viewer'] } };
  const receipt = commands.execute(args);
  f.workspace.members[0].role = 'member'; f.workspace.members[0].toolGrants.tasks.roles = ['developer'];
  const replay = () => { commands.authorize(args); return receipt; };
  assert.throws(replay, { code: 'workspace_admin_required' });
  f.workspace.members[0].toolGrants.tasks.assigned = false;
  assert.throws(replay, { code: 'workspace_read_only' });
});
test('Task-only removal releases that grant and pending reservation while preserving membership, other tools and workspaces', () => {
  const f = fixture(); f.workspace.invitations.push({ status: 'pending', email: 'two@test.invalid', reservations: ['tasks', 'files'], grants: { tasks: {}, files: {} } });
  commands.execute({ ...f, kind: 'workspace.member.remove', payload: { tool: 'tasks', userId: 2, mode: 'tool_access' } });
  const target = f.workspace.members[1]; assert.equal(target.status, 'active'); assert.equal(target.toolGrants.tasks.assigned, false); assert.equal(target.toolGrants.files.assigned, true);
  assert.deepEqual(f.workspace.invitations[0].reservations, ['files']); assert.equal(f.workspace.invitations[0].grants.tasks, undefined);
  assert.equal(f.other.members[0].toolGrants.tasks.assigned, true);
});
test('Self profile patches reject credentials/privileges and preserve the existing password hash', () => {
  const f = fixture();
  for (const key of ['password', 'passwordHash', 'userType', 'roles', 'scopes', 'isActive', 'email']) assert.throws(() => commands.execute({ ...f, kind: 'profile.self_update', payload: { patch: { [key]: 'untrusted' } } }), { code: 'invalid_profile' });
  const result = commands.execute({ ...f, kind: 'profile.self_update', payload: { patch: { firstName: 'Changed', timeZone: 'Europe/Zurich' } } });
  assert.equal(f.identity.users[0].passwordHash, 'preserved-credential'); assert.equal(result.passwordHash, undefined);
  assert.equal(f.identity.users[0].firstName, 'Changed');
});
test('First purchase assigns an existing disabled owner grant, preserves narrow roles and cannot assign twice or exceed capacity', () => {
  const f = fixture(), owner = f.workspace.members[0]; owner.toolGrants.tasks = { roles: ['viewer'], assigned: false };
  assignInitialOwnerSeats(f.S); assert.equal(owner.toolGrants.tasks.assigned, true); assert.deepEqual(owner.toolGrants.tasks.roles, ['viewer']);
  owner.toolGrants.tasks.assigned = false; assignInitialOwnerSeats(f.S); assert.equal(owner.toolGrants.tasks.assigned, false);
  const empty = fixture(); empty.workspace.members[0].toolGrants.tasks = { roles: [], assigned: false }; assignInitialOwnerSeats(empty.S); assert.deepEqual(empty.workspace.members[0].toolGrants.tasks.roles, ['super_admin']);
  const full = fixture(); full.workspace.lines[0].snapshot.quantity = 1; full.workspace.members[0].toolGrants.tasks.assigned = false; assignInitialOwnerSeats(full.S); assert.equal(full.workspace.members[0].toolGrants.tasks.assigned, false);
});
test('Person IDs use independent 48-bit secure entropy, skip collisions and fail closed after bounded exhaustion', () => {
  const source = fs.readFileSync(path.join(__dirname, 'workspace-people.js'), 'utf8');
  const sequence = [0, 1, 2, 2 ** 47 + 19], module = { exports: {} }; let fills = 0;
  vm.runInNewContext(source, { module, exports: module.exports, Buffer, require(name) {
    if (name === 'crypto' || name === 'node:crypto') return { randomFillSync(buffer) { fills++; buffer.writeUIntBE(sequence.shift() ?? 1, 0, 6); return buffer; } };
    if (name === './auth-store') return {};
    if (name === './workspace-context') return require('./workspace-context');
    if (name === './workspace-command') return require('./workspace-command');
    throw new Error('Unexpected ID allocator dependency.');
  } });
  const identity = { users: [{ id: 1 }, { id: 2 }] }, id = module.exports.allocatePersonId(identity);
  assert.equal(id, 2 ** 47 + 19); assert.equal(fills, 4); assert.equal(identity.users.length, 2);
  assert.throws(() => module.exports.allocatePersonId(identity), error => error.status === 503 && error.code === 'person_id_unavailable');
  assert.equal(fills, 36);
});
