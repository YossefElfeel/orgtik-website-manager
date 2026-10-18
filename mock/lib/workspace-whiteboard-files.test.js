const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runtime, harness, plain } = require('../apps/tasks/runtime-harness');
const codec = require('../apps/files/runtime-state');
const manifest = require('../apps/files/assets/manifest.json');
const parser = require('./whiteboard-scene');
const scene = width => ({ schema: 'orgtik.whiteboard', version: 1, elements: [{ id: 'box', type: 'rectangle', x: 0, y: 0, width, height: 60 }], appState: { viewBackgroundColor: '#ffffff' } });
function fixture(workspaceId = 'ws_board_files', options = {}) {
  const access = { read: true, write: true, files: 'active', actorId: 1 }, roles = { one: ['super_admin'], two: ['file_editor'] }, calls = [];
  const boardAuthority = { authorize(command) {
    calls.push(plain(command));
    if (command.boardId !== 'board-one' || !access.read) throw Object.assign(new Error('Board unavailable'), { status: 404, code: 'whiteboard_not_found' });
    if (command.write && !access.write) throw Object.assign(new Error('Board read-only'), { status: 403, code: 'whiteboard_write_required' });
  } };
  const f = runtime('files', workspaceId, { roles, boardAuthority, ...options });
  f.identity.currentContext = () => ({ realm: 'isolated', workspace: { id: workspaceId }, actor: { effectiveUserId: access.actorId, readOnly: false }, tools: { files: { access: access.files, canWrite: access.files === 'active', roles: roles[f.identity.findUser(access.actorId).key] } } });
  f.identity.canWrite = () => access.files === 'active';
  return { ...f, access, roles, calls };
}
const create = (f, extra = {}) => f.instance.createWhiteboard({ actorId: f.access.actorId, boardId: 'board-one', name: 'Project drawing', scene: scene(100), ...extra });
const unchanged = (f, action, status) => { const before = plain(f.instance.exportSnapshot()); assert.throws(action, error => error.status === status); assert.deepEqual(plain(f.instance.exportSnapshot()), before); };

test('explicit board creation owns canonical immutable Files content and safe metadata', () => {
  const f = fixture();
  try {
    assert.equal(f.instance.exportSnapshot().data.files.length, 0);
    const made = create(f), selected = f.instance.resolveSharedFile({ actorId: 1, fileId: made.reference.fileId, versionId: 'v1' });
    assert.equal(made.version, 1); assert.equal(made.reference.versionId, 'v1'); assert.equal(selected.mimetype, parser.MIME);
    assert.deepEqual(Object.keys(selected).sort(), ['fileId', 'mimetype', 'name', 'size', 'version', 'versionId', 'workspaceId']);
    const content = f.instance.contentSharedFile({ actorId: 1, fileId: selected.fileId, versionId: 'v1' });
    assert.ok(Buffer.isBuffer(content.bytes)); assert.equal(content.path, undefined); assert.equal(content.bytes.toString(), parser.serializeWhiteboardScene(scene(100)).json);
    assert.ok(f.calls.some(call => call.write && call.actorId === 1));
    const returned = f.instance.resolveWhiteboard({ actorId: 1, fileId: selected.fileId, versionId: 'v1' }); returned.scene.elements[0].width = 999;
    assert.equal(f.instance.resolveWhiteboard({ actorId: 1, fileId: selected.fileId, versionId: 'v1' }).scene.elements[0].width, 100);
  } finally { f.close(); }
});

test('board saves append v2 without replacing pinned v1; identical scenes are no-ops', () => {
  const f = fixture();
  try {
    const first = create(f), fileId = first.reference.fileId, old = f.instance.contentSharedFile({ actorId: 1, fileId, versionId: 'v1' }).bytes;
    const saved = f.instance.saveWhiteboard({ actorId: 1, fileId, baseVersionId: 'v1', scene: scene(240) });
    assert.equal(saved.reference.versionId, 'v2'); assert.equal(saved.version, 2);
    assert.deepEqual(f.instance.contentSharedFile({ actorId: 1, fileId, versionId: 'v1' }).bytes, old);
    assert.equal(f.instance.listSharedFiles({ actorId: 1 }).items[0].versionId, 'v2');
    const before = plain(f.instance.exportSnapshot()), same = scene(240); same.elements[0].updated = 1788888888888; same.elements[0].versionNonce = 8;
    assert.equal(f.instance.saveWhiteboard({ actorId: 1, fileId, baseVersionId: 'v2', scene: same }).reference.versionId, 'v2');
    assert.deepEqual(plain(f.instance.exportSnapshot()), before);
    unchanged(f, () => f.instance.saveWhiteboard({ actorId: 1, fileId, baseVersionId: 'v1', scene: scene(50) }), 409);
  } finally { f.close(); }
});

test('current source and Files authority are checked before scene validation or base conflicts', () => {
  const f = fixture();
  try {
    const made = create(f), fileId = made.reference.fileId;
    f.access.write = false; unchanged(f, () => f.instance.saveWhiteboard({ actorId: 1, fileId, baseVersionId: 'wrong', scene: {} }), 403);
    assert.equal(f.instance.resolveWhiteboard({ actorId: 1, fileId }).capabilities.canWrite, false);
    f.access.write = true; f.roles.one = ['file_viewer']; unchanged(f, () => f.instance.saveWhiteboard({ actorId: 1, fileId, baseVersionId: 'wrong', scene: {} }), 403);
    f.roles.one = ['super_admin']; f.identity.findUser(1).isActive = false; unchanged(f, () => f.instance.resolveWhiteboard({ actorId: 1, fileId }), 403);
    f.identity.findUser(1).isActive = true; f.access.read = false; unchanged(f, () => f.instance.resolveWhiteboard({ actorId: 1, fileId }), 404);
    assert.equal(f.instance.listSharedFiles({ actorId: 1 }).items.length, 0);
  } finally { f.close(); }
});

test('read-only Files retains saved reads while writes, archived content and custody content are unavailable', () => {
  const f = fixture(); let snapshot;
  try {
    const made = create(f), fileId = made.reference.fileId; f.access.files = 'read_only';
    assert.equal(f.instance.resolveWhiteboard({ actorId: 1, fileId }).capabilities.readOnly, true);
    unchanged(f, () => f.instance.saveWhiteboard({ actorId: 1, fileId, baseVersionId: 'v1', scene: scene(120) }), 423);
    snapshot = plain(f.instance.exportSnapshot());
  } finally { f.close(); }
  for (const field of ['deletedAt', 'custodyReadOnly']) {
    const copy = structuredClone(snapshot); copy.data.files[0][1][field] = field === 'deletedAt' ? '2026-10-07T09:00:00Z' : true;
    const restored = fixture('ws_board_files', { snapshot: copy });
    try { unchanged(restored, () => restored.instance.resolveWhiteboard({ actorId: 1, fileId: copy.data.files[0][0] }), 404); }
    finally { restored.close(); }
  }
});

test('codec preserves all scene versions on cold restore and rejects changed hashes, heads and associations', () => {
  const f = fixture(); let snapshot;
  try { const first = create(f); f.instance.saveWhiteboard({ actorId: 1, fileId: first.reference.fileId, baseVersionId: 'v1', scene: scene(220) }); snapshot = plain(f.instance.exportSnapshot()); }
  finally { f.close(); }
  const cold = fixture('ws_board_files', { snapshot });
  try { assert.deepEqual(plain(cold.instance.exportSnapshot()), snapshot); assert.equal(cold.instance.resolveWhiteboard({ actorId: 1, fileId: snapshot.data.files[0][0], versionId: 'v1' }).scene.elements[0].width, 100); }
  finally { cold.close(); }
  for (const change of [data => data.files[0][1].versions[0].hash = '0'.repeat(64), data => data.files[0][1].storage.scene.elements[0].width = 400, data => data.files[0][1].whiteboard.boardId = '__proto__', data => data.files[0][1].versions[0].storage.path = '/private', data => data.files.push(['second', { ...data.files[0][1], id: 'second' }])]) {
    const data = structuredClone(snapshot.data); change(data); assert.throws(() => codec.decode(data, manifest), { status: 503, code: 'invalid_tool_snapshot' });
  }
});

test('missing source authority fails closed only for structured boards and never broadens sample access', () => {
  const f = fixture(); let snapshot;
  try { create(f); snapshot = plain(f.instance.exportSnapshot()); } finally { f.close(); }
  const missing = runtime('files', 'ws_board_files', { snapshot });
  try {
    assert.throws(() => missing.instance.listSharedFiles({ actorId: 1 }), error => error.status === 503 && error.code === 'whiteboard_authority_unavailable');
    assert.throws(() => missing.instance.resolveWhiteboard({ actorId: 1, fileId: snapshot.data.files[0][0] }), error => error.status === 503);
    assert.ok(missing.instance.sampleCatalog({ actorId: 1 }).items.length);
  } finally { missing.close(); }
});

test('native pinned metadata/download and labelled sample preview authorize before serving bytes', async () => {
  const f = fixture(), api = await harness([f]);
  try {
    const first = create(f), fileId = first.reference.fileId;
    f.instance.saveWhiteboard({ actorId: 1, fileId, baseVersionId: 'v1', scene: scene(240) });
    const metadata = await api.call(0, 'GET', `/api/v1/files/${fileId}/versions/v1`); assert.equal(metadata.status, 200);
    assert.equal(metadata.json.data.whiteboard.versionId, 'v1'); assert.equal(metadata.json.data.whiteboard.currentVersionId, 'v2'); assert.match(metadata.json.data.url, /versions\/v1\/download$/);
    const original = await api.call(0, 'GET', `/api/v1/files/${fileId}/versions/v1/download`); assert.equal(original.status, 200); assert.equal(original.headers['content-type'].split(';')[0], parser.MIME); assert.equal(original.json.elements[0].width, 100);
    const current = await api.call(0, 'GET', `/api/v1/files/${fileId}/download`); assert.equal(current.status, 200); assert.equal(current.json.elements[0].width, 240);
    const preview = await api.call(0, 'GET', `/api/v1/files/${fileId}/versions/v1/preview`); assert.equal(preview.status, 200); assert.equal(preview.headers['x-orgtik-preview'], 'sample');
    assert.deepEqual(preview.raw, fs.readFileSync(path.join(__dirname, '../apps/files/assets', manifest.svg_whiteboard_sample.file)));
    f.access.read = false;
    for (const suffix of ['', '/download', '/versions/v1', '/versions/v1/download', '/versions/v1/preview']) assert.ok([403, 404].includes((await api.call(0, 'GET', `/api/v1/files/${fileId}${suffix}`)).status));
    assert.equal((await api.call(0, 'GET', '/api/v1/files')).json.data.items.length, 0);
    assert.equal((await api.call(0, 'GET', '/api/v1/activity-logs')).json.data.items.length, 0);
  } finally { await api.close(); }
});

test('signed folder ZIP contains canonical scenes while public folder traversal and ZIP exclude boards', async () => {
  const f = fixture(), api = await harness([f]);
  try {
    const folder = (await api.call(0, 'POST', '/api/v1/folders', { name: 'Boards' })).json.data;
    const made = create(f, { parentId: folder.id }), fileId = made.reference.fileId;
    const zip = await api.call(0, 'GET', `/api/v1/folders/${folder.id}/download`); assert.equal(zip.status, 200); assert.ok(zip.raw.includes(Buffer.from('Project drawing.whiteboard.json')));
    const directShare = await api.call(0, 'POST', '/api/v1/shares', { resourceType: 'file', resourceId: fileId, permission: 'download' });
    assert.equal(directShare.status, 422); assert.equal(directShare.json.code, 'whiteboard_public_sharing_unavailable');
    const share = (await api.call(0, 'POST', '/api/v1/shares', { resourceType: 'folder', resourceId: folder.id, permission: 'download' })).json.data;
    const secret = new URL(share.shareUrl).searchParams.get('secret'), opened = await api.call(0, 'POST', `/api/v1/public/shares/${share.id}/session`, { secret }); assert.equal(opened.status, 204);
    const cookie = opened.headers['set-cookie'][0].split(';')[0];
    const listing = await api.call(0, 'GET', `/api/v1/public/shares/${share.id}/items`, undefined, { cookie }); assert.equal(listing.status, 200); assert.equal(listing.json.data.items.length, 0);
    for (const suffix of ['download', 'preview']) assert.equal((await api.call(0, 'GET', `/api/v1/public/shares/${share.id}/files/${fileId}/${suffix}`, undefined, { cookie })).status, 404);
    const publicZip = await api.call(0, 'GET', `/api/v1/public/shares/${share.id}/download`, undefined, { cookie }); assert.equal(publicZip.status, 200); assert.equal(publicZip.raw.includes(Buffer.from('Project drawing.whiteboard.json')), false);
  } finally { await api.close(); }
});

test('Files passes its actual record ID to source authority and refuses a mismatched association', async () => {
  let expectedFileId;
  const boardAuthority = { authorize({ fileId }) { if (fileId !== undefined && expectedFileId && fileId !== expectedFileId) throw Object.assign(new Error('Wrong board file binding'), { status: 404 }); } };
  const first = fixture('ws_binding_board', { boardAuthority }); let snapshot;
  try {
    expectedFileId = create(first).reference.fileId;
    assert.equal(first.instance.resolveWhiteboard({ actorId: 1, fileId: expectedFileId }).reference.fileId, expectedFileId);
    snapshot = plain(first.instance.exportSnapshot());
  } finally { first.close(); }
  snapshot.data.files[0][0] = 'foreign-file'; snapshot.data.files[0][1].id = 'foreign-file';
  const wrong = fixture('ws_binding_board', { snapshot, boardAuthority }), api = await harness([wrong]);
  try {
    assert.throws(() => wrong.instance.resolveWhiteboard({ actorId: 1, fileId: 'foreign-file' }), error => error.status === 404);
    assert.equal((await api.call(0, 'GET', '/api/v1/files/foreign-file')).status, 403);
    assert.equal(wrong.instance.listSharedFiles({ actorId: 1 }).items.length, 0);
  } finally { await api.close(); }
});

test('recursive archive, restore, access, move and purge preflight source writes before changing any candidate', async () => {
  const f = fixture();
  // Match the registry's error boundary around this direct adapter-only harness.
  f.instance.router.use((error, _req, res, _next) => res.status(error.status || 503).json({ success: false, code: error.code }));
  const api = await harness([f]);
  const refusedUnchanged = async (method, route, body) => { const before = plain(f.instance.exportSnapshot()); const result = await api.call(0, method, route, body); assert.equal(result.status, 403, route); assert.deepEqual(plain(f.instance.exportSnapshot()), before); };
  try {
    const folder = (await api.call(0, 'POST', '/api/v1/folders', { name: 'Board source' })).json.data;
    const target = (await api.call(0, 'POST', '/api/v1/folders', { name: 'Board target' })).json.data;
    const board = create(f, { parentId: folder.id }); f.access.write = false;
    await refusedUnchanged('PATCH', `/api/v1/files/${board.reference.fileId}/archive`, {});
    await refusedUnchanged('PATCH', `/api/v1/folders/${folder.id}/archive`, {});
    await refusedUnchanged('PATCH', `/api/v1/folders/${folder.id}/move`, { targetParentId: target.id });
    await refusedUnchanged('PATCH', `/api/v1/folders/${folder.id}`, { name: 'No partial rename', visibility: 'everyone' });
    f.access.write = true; assert.equal((await api.call(0, 'PATCH', `/api/v1/folders/${folder.id}/archive`, {})).status, 200); f.access.write = false;
    await refusedUnchanged('PATCH', `/api/v1/archive/folders/${folder.id}/restore`, {});
    await refusedUnchanged('PATCH', '/api/v1/archive/folders/restore', { ids: [folder.id] });
    await refusedUnchanged('DELETE', `/api/v1/archive/files/${board.reference.fileId}`, { password: 'fixture-password' });
    await refusedUnchanged('DELETE', `/api/v1/archive/folders/${folder.id}`, { password: 'fixture-password' });
  } finally { await api.close(); }
});

test('trusted Files custody archives association-ineligible boards and fails before mutation without its callback', () => {
  for (const eligible of [true, false, undefined]) {
    const boardAuthority = { authorize() {}, ...(eligible === undefined ? {} : { custodyTarget(args) { assert.deepEqual(plain(args), { boardId: 'board-one', fromUserId: 1, targetUserId: 2 }); return eligible; } }) };
    const f = fixture('ws_custody_board', { boardAuthority });
    try {
      const made = create(f);
      if (eligible === undefined) {
        unchanged(f, () => f.instance.transferOwnership({ fromUserId: 1, target: { kind: 'member', userId: 2 }, operationId: 'board-custody' }), 503);
      } else {
        const result = f.instance.transferOwnership({ fromUserId: 1, target: { kind: 'member', userId: 2 }, operationId: 'board-custody' }), row = f.instance.exportSnapshot().data.files[0][1];
        assert.equal(row.ownerId, eligible ? 2 : null); assert.equal(row.custodyReadOnly === true, !eligible);
        assert.ok((eligible ? result.transferred : result.archived).includes('file:' + made.reference.fileId));
        if (!eligible) assert.throws(() => f.instance.resolveWhiteboard({ actorId: 1, fileId: made.reference.fileId }), error => error.status === 404);
      }
    } finally { f.close(); }
  }
});
