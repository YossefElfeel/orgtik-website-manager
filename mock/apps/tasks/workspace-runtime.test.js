const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, harness, plain } = require('./runtime-harness');

test('two private Tasks graphs isolate overlapping IDs and preserve deleted-highest counters across hydration', async () => {
  const first = runtime('tasks', 'ws_a'), second = runtime('tasks', 'ws_b');
  const http = await harness([first, second]);
  let snapshot;
  try {
    const created = await Promise.all([http.call(0, 'POST', '/api/projects', { title: 'Workspace Alpha' }), http.call(1, 'POST', '/api/projects', { title: 'Workspace Beta' })]);
    assert.deepEqual(created.map(result => result.status), [201, 201]);
    assert.equal(created[0].json.data.id, created[1].json.data.id);
    const reads = await Promise.all([http.call(0, 'GET', '/api/projects/1'), http.call(1, 'GET', '/api/projects/1')]);
    assert.equal(reads[0].json.data.title, 'Workspace Alpha'); assert.equal(reads[1].json.data.title, 'Workspace Beta');
    assert.equal((await http.call(0, 'GET', '/api/projects/1', undefined, { 'x-user': '' })).status, 401);
    assert.equal((await http.call(0, 'DELETE', '/api/projects/1')).status, 200);
    snapshot = plain(first.instance.exportSnapshot());
  } finally { await http.close(); }
  const restored = runtime('tasks', 'ws_a', { snapshot }), again = await harness([restored]);
  try { const created = await again.call(0, 'POST', '/api/projects', { title: 'Restored next project' }); assert.equal(created.json.data.id, 2); }
  finally { await again.close(); }
  assert.throws(() => runtime('tasks', 'ws_other', { snapshot }), error => error.status === 503);
});

test('Tasks global super-admin grants cannot promote a scoped viewer', async () => {
  const restricted = runtime('tasks', 'ws_viewer', { roles: { one: ['viewer'], two: ['developer'] } });
  const http = await harness([restricted]);
  try {
    assert.equal((await http.call(0, 'POST', '/api/projects', { title: 'Forbidden project' })).status, 403);
    assert.equal(restricted.instance.exportSnapshot().data.projects.length, 0);
    assert.throws(() => restricted.instance.bootstrap({ mode: 'public_resource' }), error => error.status === 403);
  } finally { await http.close(); }
});

test('Tasks custody transfer keeps original authors and does not replay effects', async () => {
  const owner = runtime('tasks', 'ws_custody'), http = await harness([owner]);
  try {
    assert.equal((await http.call(0, 'POST', '/api/projects', { title: 'Transfer me', isPrivate: true })).status, 201);
    const result = owner.instance.transferOwnership({ fromUserId: 1, target: { kind: 'member', userId: 2 }, operationId: 'transfer-one' });
    assert.ok(result.transferred.includes('project:1'));
    const project = owner.instance.exportSnapshot().data.projects[0];
    assert.equal(project.createdById, 1); assert.equal(project.ownerId, 2); assert.ok(project.memberIds.includes(2));
    assert.equal(owner.instance.transferOwnership({ fromUserId: 1, target: { kind: 'member', userId: 2 }, operationId: 'transfer-one' }).transferred.length, 0);
    owner.instance.transferOwnership({ fromUserId: 2, target: { kind: 'archive' }, operationId: 'archive-one' });
    assert.equal((await http.call(0, 'PUT', '/api/projects/1', { title: 'Must stay archived' })).status, 423);
  } finally { await http.close(); }
});
