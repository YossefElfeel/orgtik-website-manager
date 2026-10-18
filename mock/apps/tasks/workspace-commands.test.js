const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, harness, plain } = require('./runtime-harness');

test('Tasks and Files profile callbacks pass the verified actor and strict patch to the shared command service', async () => {
  const calls = [], commands = { execute(kind, payload, metadata) { calls.push(plain({ kind, payload, metadata })); } };
  const tasks = runtime('tasks', 'tasks-ws', { commands }), files = runtime('files', 'files-ws', { commands });
  const api = await harness([tasks, files]);
  try {
    for (const [index, workspaceId] of [[0, 'tasks-ws'], [1, 'files-ws']]) {
      assert.equal((await api.call(index, 'PUT', '/api/auth/profile', { firstName: 'Changed', timeZone: 'Europe/Zurich' }, { 'Idempotency-Key': 'profile-' + index })).status, 200);
      assert.deepEqual(calls.at(-1), { kind: 'profile.self_update', payload: { patch: { firstName: 'Changed', timeZone: 'Europe/Zurich' } }, metadata: { actor: { userId: 1, effectiveUserId: 1 }, workspaceId, operationId: 'profile-' + index } });
      assert.equal((await api.call(index, 'PUT', '/api/auth/profile', { firstName: 'Changed', userId: 2, password: 'Never journal this' })).status, 422);
      assert.equal((await api.call(index, 'POST', '/api/auth/avatar', {})).status, 501);
    }
    assert.equal(calls.length, 2);
    assert.equal(tasks.identity.findUser(1).firstName, 'One'); assert.equal(files.identity.findUser(1).firstName, 'One');
  } finally { await api.close(); }
});

test('Tasks role and removal adapters do not edit global grants or remove other-workspace access', async () => {
  const calls = [], tasks = runtime('tasks', 'workspace', { commands: { execute(kind, payload, metadata) { calls.push(plain({ kind, payload, metadata })); return { removed: true, tool: 'tasks' }; } } });
  const api = await harness([tasks]);
  try {
    assert.equal((await api.call(0, 'POST', '/api/rbac/users/2/roles', { roleIds: [4] }, { 'Idempotency-Key': 'role' })).status, 200);
    assert.deepEqual(calls[0].payload, { tool: 'tasks', userId: 2, roles: ['viewer'] });
    assert.equal((await api.call(0, 'DELETE', '/api/users/2', undefined, { 'Idempotency-Key': 'remove' })).status, 200);
    assert.deepEqual(calls[1].payload, { tool: 'tasks', userId: 2, mode: 'tool_access' });
    assert.deepEqual(tasks.identity.userScopes(tasks.identity.findUser(2))[0].roles, ['developer']);
    assert.deepEqual(tasks.identity.grants.global.one.roles, ['super_admin']);
    assert.equal((await api.call(0, 'DELETE', '/api/users/2', undefined, { 'x-user': '2' })).status, 403);
    assert.equal(calls.length, 2);
  } finally { await api.close(); }
});

test('A failed shared profile command returns failure without changing the person or tool snapshot', async () => {
  const tasks = runtime('tasks', 'workspace', { commands: { execute() { throw Object.assign(new Error('Isolated persistence failure'), { status: 503, code: 'persistence_unavailable' }); } } });
  const api = await harness([tasks]);
  try {
    const snapshot = plain(tasks.instance.exportSnapshot());
    const failed = await api.call(0, 'PUT', '/api/auth/profile', { lastName: 'Not saved' });
    assert.equal(failed.status, 503); assert.equal(failed.json.success, false); assert.equal(tasks.identity.findUser(1).lastName, 'Owner');
    assert.deepEqual(plain(tasks.instance.exportSnapshot()), snapshot);
  } finally { await api.close(); }
});
