const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, harness, plain } = require('../tasks/runtime-harness');

test('Files private graphs isolate folders, public capabilities and byte assets', async () => {
  const first = runtime('files', 'ws_nile', { fixtureId: 'nile-v1' }), second = runtime('files', 'ws_empty');
  const http = await harness([first, second]);
  try {
    const file = first.instance.exportSnapshot().data.files[0][1];
    assert.equal((await http.call(0, 'GET', '/api/v1/files/' + file.id + '/download')).status, 200);
    assert.equal((await http.call(1, 'GET', '/api/v1/files/' + file.id + '/download')).status, 404);
    const created = await http.call(0, 'POST', '/api/v1/shares', { resourceType: 'file', resourceId: file.id, permission: 'download' });
    assert.equal(created.status, 201);
    const id = created.json.data.id, secret = new URL(created.json.data.shareUrl).searchParams.get('secret');
    assert.equal((await http.call(1, 'POST', '/api/v1/public/shares/' + id + '/session', { secret })).status, 404);
    const session = await http.call(0, 'POST', '/api/v1/public/shares/' + id + '/session', { secret });
    assert.equal(session.status, 204);
    const snapshot = plain(first.instance.exportSnapshot());
    assert.equal(JSON.stringify(snapshot).includes(secret), false);
    assert.equal(snapshot.data.sessions.length, 1); assert.equal(snapshot.data.shares[0][1].secret, undefined);
    const cookie = session.headers['set-cookie'][0].split(';')[0];
    assert.equal((await http.call(0, 'GET', '/api/v1/public/shares/' + id + '/files/' + file.id + '/download', undefined, { cookie })).status, 200);
    assert.equal((await http.call(1, 'GET', '/api/v1/public/shares/' + id + '/files/' + file.id + '/download', undefined, { cookie })).status, 404);
    assert.equal((await http.call(0, 'POST', '/api/v1/files/upload', {})).status, 501);
    assert.throws(() => first.instance.bootstrap({ mode: 'public_resource' }), error => error.status === 403);
  } finally { await http.close(); }
});

test('Files userType/global roles do not promote a scoped guest; ownership archives are read-only', async () => {
  const restricted = runtime('files', 'ws_guest', { roles: { one: ['file_guest'], two: ['file_editor'] } });
  const http = await harness([restricted]);
  try { assert.equal((await http.call(0, 'POST', '/api/v1/folders', { name: 'Forbidden folder' })).status, 403); }
  finally { await http.close(); }
  const owner = runtime('files', 'ws_owner'), writer = await harness([owner]);
  try {
    const folder = await writer.call(0, 'POST', '/api/v1/folders', { name: 'Transfer folder' });
    assert.equal(folder.status, 201);
    const result = owner.instance.transferOwnership({ fromUserId: 1, target: { kind: 'member', userId: 2 }, operationId: 'transfer-folder' });
    assert.equal(result.transferred.length, 1);
    assert.equal(owner.instance.transferOwnership({ fromUserId: 1, target: { kind: 'member', userId: 2 }, operationId: 'transfer-folder' }).transferred.length, 0);
    owner.instance.transferOwnership({ fromUserId: 2, target: { kind: 'archive' }, operationId: 'archive-folder' });
    const archived = owner.instance.exportSnapshot().data.folders[0][1];
    assert.equal(archived.ownerId, null); assert.equal(archived.custodyReadOnly, true);
  } finally { await writer.close(); }
});

test('Files snapshot cold-start hydration retains hashes, counters and version metadata', async () => {
  const first = runtime('files', 'ws_nile', { fixtureId: 'nile-v1' }), http = await harness([first]);
  let snapshot;
  try {
    const file = first.instance.exportSnapshot().data.files[0][1];
    await http.call(0, 'POST', '/api/v1/shares', { resourceType: 'file', resourceId: file.id });
    snapshot = plain(first.instance.exportSnapshot());
  } finally { await http.close(); }
  const restored = runtime('files', 'ws_nile', { fixtureId: 'nile-v1', snapshot });
  try { assert.deepEqual(plain(restored.instance.exportSnapshot()), snapshot); }
  finally { restored.close(); }
});
