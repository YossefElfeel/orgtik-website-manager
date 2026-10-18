const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, harness, plain } = require('../apps/tasks/runtime-harness');
const refs = require('./workspace-file-references');
const reference = { workspaceId: 'files-flow', fileId: 'file-one', versionId: 'v1' };
function service() {
  let unavailable = false;
  const metadata = { ...reference, name: 'Release.pdf', mimetype: 'application/pdf', size: 350, version: 1 };
  return {
    deny(value) { unavailable = value; },
    resolve(value) { refs.reference(value, reference.workspaceId); if (unavailable) throw Object.assign(new Error('Not found'), { status: 404, code: 'file_not_found' }); return metadata; },
    project(value) { return unavailable ? { state: 'unavailable' } : { state: 'available', file: this.resolve(value) }; },
  };
}
async function task(api) {
  const project = await api.call(0, 'POST', '/api/projects', { title: 'Files delivery', isPrivate: true });
  assert.equal(project.status, 201);
  const sections = (await api.call(0, 'GET', '/api/projects/1')).json.data.sections;
  const created = await api.call(0, 'POST', `/api/tasks/sections/${sections[0].section.id}`, { title: 'Reference work' });
  assert.equal(created.status, 201); return created.json.data.id;
}
test('minimum references reject guessed workspaces, unchecked metadata and incomplete versions', () => {
  assert.deepEqual(refs.reference(reference, 'files-flow'), reference);
  for (const value of [{ ...reference, name: 'Forged' }, { workspaceId: 'files-flow', fileId: 'file-one' }, { ...reference, versionId: null }, { ...reference, fileId: '__proto__' }]) assert.throws(() => refs.reference(value, 'files-flow'), error => error.status === 422);
  assert.throws(() => refs.reference(reference, 'another'), error => error.status === 404);
});
test('Tasks router persists minimal references, recovers duplicate actions and redacts revoked metadata', async () => {
  const sharedFiles = service(), app = runtime('tasks', 'files-flow', { sharedFiles }), api = await harness([app]); let snapshot, taskId, attachmentId;
  try {
    const id = taskId = await task(api), route = `/api/tasks/${id}/attachments`, body = { references: [reference] }, headers = { 'Idempotency-Key': 'attach-one' };
    const first = await api.call(0, 'POST', route, body, headers); assert.equal(first.status, 201); attachmentId = first.json.data[0].id;
    const second = await api.call(0, 'POST', route, body, headers);
    assert.equal(second.status, 201); assert.equal(second.json.data[0].id, attachmentId);
    assert.equal((await api.call(0, 'POST', route, body, { 'Idempotency-Key': 'same-file-new-action' })).status, 201);
    assert.equal(app.instance.exportSnapshot().data.attachments.length, 1);
    const allowed = (await api.call(0, 'GET', `/api/tasks/${id}`)).json.data.attachments[0];
    assert.equal(allowed.originalName, 'Release.pdf'); assert.equal(allowed.fileUrl, null);
    assert.ok(allowed.contentPath.endsWith(`referenceId=${attachmentId}`));
    app.instance.authorizeSharedTarget({ actorId: 1, type: 'task', id, referenceId: String(attachmentId), reference });
    assert.throws(() => app.instance.authorizeSharedTarget({ actorId: 2, type: 'task', id }), error => error.status === 404);
    assert.throws(() => app.instance.authorizeSharedTarget({ actorId: 1, type: 'task', id, referenceId: '999', reference }), error => error.status === 404);
    const stored = app.instance.exportSnapshot().data.attachments[0];
    assert.deepEqual(Object.keys(stored).sort(), ['createdAt', 'id', 'reference', 'taskId', 'uploadedById']);
    sharedFiles.deny(true);
    const denied = (await api.call(0, 'GET', `/api/tasks/${id}`)).json.data.attachments[0];
    assert.equal(denied.state, 'unavailable'); assert.equal(denied.originalName, ''); assert.equal(denied.size, 0); assert.equal(denied.contentPath, undefined);
    assert.equal((await api.call(0, 'POST', route, body, headers)).status, 404);
    sharedFiles.deny(false);
    assert.equal((await api.call(0, 'POST', route, { references: [{ ...reference, versionId: 'v2' }] }, headers)).status, 409);
    snapshot = plain(app.instance.exportSnapshot());
  } finally { await api.close(); }
  const cold = runtime('tasks', 'files-flow', { snapshot, sharedFiles }), restored = await harness([cold]);
  try {
    assert.equal((await restored.call(0, 'DELETE', `/api/tasks/attachments/${attachmentId}`, undefined, { 'Idempotency-Key': 'remove-one' })).status, 200);
    assert.equal((await restored.call(0, 'DELETE', `/api/tasks/attachments/${attachmentId}`, undefined, { 'Idempotency-Key': 'remove-one' })).status, 200);
    assert.equal(cold.instance.exportSnapshot().data.attachments.length, 0);
    assert.equal((await restored.call(0, 'POST', `/api/tasks/${taskId}/attachments`, { references: [reference] }, { 'Idempotency-Key': 'attach-one' })).json.data.length, 0);
  } finally { await restored.close(); }
  const corrupt = structuredClone(snapshot); corrupt.data.attachments[0].reference.workspaceId = 'other';
  assert.throws(() => runtime('tasks', 'files-flow', { snapshot: corrupt, sharedFiles }), error => error.status === 503);
});
test('Chats attachment-only messages use canonical references and retain receipts beyond the rolling command window', async () => {
  const sharedFiles = service(), app = runtime('chats', 'files-flow', { sharedFiles }), api = await harness([app]); let snapshot;
  const command = (event, key) => api.call(0, 'POST', '/api/hq/commands', { event }, { 'Idempotency-Key': key });
  try {
    assert.equal((await command({ type: 'channel.created', channel: { id: 'private-files', name: 'Files review', kind: 'private', memberIds: ['1'] } }, 'create-channel')).status, 200);
    const event = { type: 'message.created', message: { channelId: 'private-files', text: '', attachments: [reference] } };
    assert.equal((await command(event, 'send-file')).status, 200);
    const boot = (await api.call(0, 'GET', '/api/hq/bootstrap')).json.data, attachment = boot.messages[0].attachments[0];
    assert.equal(attachment.name, 'Release.pdf'); assert.equal(attachment.state, 'available'); assert.equal(boot.messages[0].fileOperation, undefined);
    assert.match(attachment.contentPath, /resourceType=message&resourceId=m-1/);
    app.instance.authorizeSharedTarget({ actorId: 1, type: 'message', id: 'm-1', referenceId: 'file-one:v1', reference });
    assert.throws(() => app.instance.authorizeSharedTarget({ actorId: 2, type: 'message', id: 'm-1', referenceId: 'file-one:v1', reference }), error => error.status === 404);
    for (let index = 0; index < 257; index++) assert.equal((await command({ type: 'channel.read', channelId: 'private-files' }, `read-${index}`)).status, 200);
    assert.equal((await command(event, 'send-file')).json.data.messages.length, 1);
    sharedFiles.deny(true);
    const denied = (await api.call(0, 'GET', '/api/hq/bootstrap')).json.data.messages[0].attachments[0];
    assert.equal(denied.name, ''); assert.equal(denied.size, ''); assert.equal(denied.contentPath, undefined); assert.equal(denied.state, 'unavailable');
    assert.equal((await command(event, 'send-file')).status, 404);
    sharedFiles.deny(false);
    snapshot = plain(app.instance.exportSnapshot());
    assert.deepEqual(snapshot.data.messages[0].attachments, [{ reference }]);
  } finally { await api.close(); }
  const cold = runtime('chats', 'files-flow', { snapshot, sharedFiles }), restored = await harness([cold]);
  try { assert.equal((await restored.call(0, 'POST', '/api/hq/commands', { event: { type: 'message.created', message: { channelId: 'private-files', text: '', attachments: [reference] } } }, { 'Idempotency-Key': 'send-file' })).json.data.messages.length, 1); }
  finally { await restored.close(); }
  const corrupt = structuredClone(snapshot); corrupt.data.messages[0].attachments[0].reference.workspaceId = 'other';
  assert.throws(() => runtime('chats', 'files-flow', { snapshot: corrupt, sharedFiles }), error => error.status === 503);
});
